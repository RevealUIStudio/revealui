/**
 * GAP-467: body prose units for every live static blog post.
 * Generated from extractBlogMdProseUnits — re-run when bodies change.
 */

import { BLOG_POST_METADATA } from '../../lib/blog-registry.js';
import type { ClaimEntry } from './types.js';

export const BLOG_BODY_CLAIM_SLUGS = BLOG_POST_METADATA.map((p) => p.slug);

export const blogBodyClaims: readonly ClaimEntry[] = [
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.0',
    text: 'Most agent software is easy to demo and hard to leave behind. The customer has a working prototype, a real data boundary, and one fair question: if you walk away, what do they still own?',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.1',
    text: 'Palantir coined the title for the people who answer that in the field. The rest of the industry caught up. OpenAI, Anthropic, Google, Databricks, Salesforce, and a long line of vertical AI companies hire forward deployed engineers because demos do not deploy themselves. a16z called the same motion the hottest job in startups for a reason: complex AI needs implementation.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.2',
    text: "Most of those teams still leave a vendor-owned stack. RevealUI is the self-hosted runtime built for a different handoff. Your business and the agents that run it live under one roof. Every agent is a governed and audited user that lives on your infrastructure. Studio's job is the forward-deployed practice on that runtime: stamp, wire, hand over, leave the keys.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.3',
    text: 'The job is bigger than one company',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.4',
    text: 'Palantir named the role. By 2026 the hiring market owns it. Labs, data platforms, vertical AI companies, defense tech, and consultancies all staff people whose job is to make agent demos survive real data, real compliance, and real operators.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.5',
    text: 'The same work shows up under different badges: Forward Deployed Engineer, Applied AI Engineer, Deployment Engineer. Filter on the scenario, not the title. A working agent demo dies at the customer wall: their data, their cloud, their compliance fear, and the fair question of who owns the system when the embed ends.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.6',
    text: 'The failure mode is a vendor stack you cannot keep',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.7',
    text: 'Most of those hires still land customers on infrastructure the vendor controls. The embed "succeeds" when the customer renews the vendor. That is a legitimate business model. It is not the only success condition.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.8',
    text: 'A different one: the deployer leaves a runtime the **customer** owns. The agents keep running after the visit. The data stays where the customer put it. The record of what agents did is something the customer can inspect.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.9',
    text: 'What has to be true for handoff',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.10',
    text: 'Five things, not a slogan:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.11',
    text: '**Customer-owned deploy.** The product runs on infrastructure they control, not only on a hosted demo tenant.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.12',
    text: '**Business primitives already in the runtime.** Auth, content, offers, payments, and agents are not a greenfield rewrite per engagement.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.13',
    text: '**Agents as governed users.** Same identity and policy surface as people, not shadow scripts with a private side channel.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.14',
    text: "**A receipt path the customer can inspect.** If an agent did it, there's a receipt. Soft foil only: no certification claims; Merkle root *delivery* is Max+; verification is never paid.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.15',
    text: '**Provider choice.** The model is not the lock-in. Closed APIs stay opt-in adapters.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.16',
    text: 'If any of those are missing, the handoff is a laptop dependency with a nicer name.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.17',
    text: 'Owner-operators who *are* their own forward-deployed person',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.18',
    text: "Independent deployers and small studios who will never be a lab's FDE headcount but do the same job",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.19',
    text: 'Agencies and MSPs who productize the motion for clients',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.20',
    text: 'Who this is not for: six-month enterprise POCs that need a certification stamp before a first install. That path exists elsewhere. It is not the first-mile product.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.21',
    text: 'What Studio ships into the field',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.22',
    text: 'RevealUI Studio productizes the motion on the runtime: Architecture Review, Fleet deployment, Custom Build, and related fixed-bid work. The product noun stays **runtime**. The homepage is for owner-operators who run their own business on it. Forward-deployed delivery is how field work enters, not a rename of the product.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.23',
    text: 'You can read the runtime, run it, and check the claims against code. Used in production by the team that maintains it. That is the only production claim this post makes.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.24',
    text: 'The industry already decided last-mile humans matter. The open question is what they leave behind.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.25',
    text: "RevealUI's answer: a customer-owned runtime where your business and the agents that run it live under one roof, and every agent is a user with a receipt trail you can check.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-runtime-for-fde-work',
    exportPath: 'body.26',
    text: 'Start with the source: [github.com/RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui). Or start a conversation about a fixed-bid engagement at [revealuistudio.com](https://revealuistudio.com).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/18-open-runtime-for-fde-work.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.0',
    text: 'I spent about ten years managing and training people in AT&T and T-Mobile authorized retail. High volume. Real customers. Teams that had to show up and perform whether the systems cooperated or not. That job taught me something software culture often forgets: if you cannot hand a system off to someone else and have it still work, you did not finish.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.1',
    text: 'In 2019 I started teaching myself to code while running my own businesses. I was not chasing a credential. I was trying to stop renting every critical piece of a company from someone else. I built a fleet of software that began as a full-stack framework for multi-product businesses: the boring, load-bearing parts that every product needs before the product is allowed to exist.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.2',
    text: 'Then generative AI stopped being a demo and started being a force that rewrites work. I could have bolted a chat box onto what I already had and called it a day. I did not. I rebuilt the fleet for that future. The result is RevealUI: a self-hosted runtime where your business and the AI agents that run it live under one roof. Every agent is a governed and audited user that lives on your infrastructure.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.3',
    text: "If an agent did it, there's a receipt.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.4',
    text: 'The split I refuse to ignore',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.5',
    text: 'AI is advancing fast enough that outcomes are splitting. Some people will own the tools, the infrastructure, and the upside. Many will not. Economists call shapes like that K-shaped. You do not need a chart to feel it. You only need to watch who gets leverage from new models and who gets automated past without a path up.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.6',
    text: "I did not want my life's work to be a private machine that makes me rich while that split widens. I wanted what I learned to be shareable and usable. Not a TED talk. Not a thread of advice with no floor under it. A system people can run.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.7',
    text: 'That is why the extra years went into the fleet instead of the shortest path to a closed product and a quiet exit. Open and fair-source packages. Self-host on infrastructure you control. Provider choice so the model is not the lock-in. A studio practice built to deploy and hand off, not to keep you dependent forever.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.8',
    text: 'I am still allowed to make a living. Paid work and public work can fund each other. The point is not purity theater. The point is that the default shape of the thing is shareable.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.9',
    text: 'I will be direct. I do not have a wall of famous logos to hide behind. The honest stage of this work is: the code is real, the thesis is lived, and the commercial proof is still being earned. So yes, there is a leap of faith.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.10',
    text: 'The leap is not "trust me forever." The leap is "give the work a fair look." Read the repo. Run what you can. Ask hard questions. If the craft holds, take the next step. If it does not, walk away. I would rather lose you on the merits than keep you with marketing.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.11',
    text: 'What I will not do is pretend a slogan is the same as a handoff. Mission without a runnable path is a speech. Mission with a runnable path is an invitation.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.12',
    text: 'What "shareable" means in practice',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.13',
    text: 'Shareable is not a feeling. It is a set of choices.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.14',
    text: '**You can read it.** Source is public for the open packages. Pro packages are fair source with a path that does not pretend secrecy is the product.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.15',
    text: '**You can run it.** The runtime is meant to live on infrastructure you own or control, not only as a rented dashboard you cannot move.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.16',
    text: '**You can choose the model.** Closed APIs are adapters. The business runtime should not die when a vendor changes a price or a policy.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.17',
    text: "**You can be left with it.** RevealUI Studio's job, when you hire us, is forward-deployed in spirit: stamp, wire, train, hand over. You keep the runtime. I spent a decade training people in retail. I know what unfinished training looks like. I do not want to sell unfinished training with a prettier UI.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.18',
    text: '**Agents are not a side script.** They are users of the same business system, with policy and a trail you can check. That is the only way "AI runs part of the business" stays something a human can supervise.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.19',
    text: 'If you are a technical founder or a small team that wants to run your business and your agents on something you own, this is for you.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.20',
    text: 'If you deploy systems for other people (the industry now calls that forward deployed work, under several job titles), this is a substrate you can leave behind when the engagement ends.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.21',
    text: 'If you only want a magic button that prints money with no learning, this is not for you. The upward side of a K-shaped curve still requires a leap and then work. I can remove the false choice between "learn alone with nothing" and "rent everything forever." I cannot remove effort.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.22',
    text: 'Retail manager and trainer for about a decade. Self-taught engineer from 2019 while running businesses. Builder of a software fleet that started as a full-stack framework and was rebuilt for the agent era. Founder of RevealUI Studio. Someone who wants more people on the upward side of what AI is doing to the economy, and who is willing to put years into a shareable system instead of only extracting the upside for himself.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.23',
    text: 'Product: [revealui.com](https://revealui.com)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.24',
    text: 'Code: [github.com/RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.25',
    text: 'Studio: [revealuistudio.com](https://revealuistudio.com)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.26',
    text: 'If it earns your trust, take the leap. Host it. Break it. Tell me where it fails. Hire the studio if you want a hand with the last mile. Or build on your own with the same discipline of putting real systems in real hands. The goal is not that every path runs through me. The goal is that more people own the upside.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/shareable-upside',
    exportPath: 'body.27',
    text: 'I built this so you could keep the runtime.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/17-shareable-upside.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.0',
    text: 'Everyone in software is asking the same question right now. What does the interface of the AI era look like? The industry keeps answering with variations of a chat window. A sidebar copilot. An autocomplete that got ambitious. A bot in the corner of a screen that was designed for clicking.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.1',
    text: 'I think those are all wrong, and I think they are wrong in the same way. They assume the interface of the future is still a place where you go to do the work.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.2',
    text: 'Here is my thesis. The UI of the future is not a screen. It is your business itself. You express what you want. A workforce of agents operates the machinery: the content, the offers, the payments, the follow-ups, the bookkeeping of it all. What you look at is not forms and dashboards. What you look at is outcomes, and the receipts that prove how they happened. The interface stops being where you do the work and becomes where you direct it and where you verify it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.3',
    text: 'That interface has not revealed itself yet. Not because the models are too weak. Because two preconditions are missing almost everywhere, and nobody wants to say it plainly.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.4',
    text: 'I did not come to this the traditional way. Before software I spent ten years as a business manager and trainer, watching industries change and watching what happened to the products and people who refused to change with them. When I made the jump to engineering I taught myself, and then I started building the tool I wished had existed when I set out: a batteries-included full-stack framework whose education modules were built from its own codebase, a bootcamp that taught you the source from data structures and algorithms all the way up to the abstractions of the libraries and frameworks on top.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.5',
    text: 'The month I finished it, the first LLMs hit the general market. I watched where the money was going and understood immediately that the industry had made a decisive pivot, and that radical acceptance was the best path forward. So I rewrote everything around what LLMs do to the software development lifecycle. The problem I wanted to solve did not change. The solution did.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.6',
    text: 'I kept hearing leaders at the top AI companies say some version of the same thing in interviews: we cannot do what we set out to do and also handle the disruption of the markets we are creating, but somebody definitely should. I decided to be one of those people. I wanted to make a tool that does not require you to know as much as an engineer to use it, but that enhances an engineer at the same time. RevealUI is my way of helping people change as fast as this industry does.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.7',
    text: 'The first precondition is proof',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.8',
    text: 'If agents are going to run real parts of a real business, "trust me" is not an answer. You would never hire an employee who refused to tell you what they did with your money and your customers. An agent should be held to the same standard, and it should be held to it structurally, not politely.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.9',
    text: 'That means every agent is a governed and audited user that lives on your infrastructure. It gets an identity like a person. It gets permissions like a person. And every action it takes can land in a signed record you can check offline.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.10',
    text: "If an agent did it, there's a receipt.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.11',
    text: 'That standard carries more weight than any benchmark. A business you cannot inspect is a business you do not control, no matter how impressive the demo was.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.12',
    text: 'The second precondition is ownership',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.13',
    text: "Almost every agent you can buy today lives in someone else's cloud. Your data goes to their servers. The memory your agents build up belongs to their product. The record of what happened is theirs to keep, theirs to price, and theirs to lose. You are not building a workforce. You are renting one, seat by seat, and the landlord can change the terms whenever it likes.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.14',
    text: "You cannot build a life's work on a rented workforce.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.15',
    text: 'So the second precondition is that the whole thing lives under your roof. RevealUI is the self-hosted runtime where your business and the AI agents that run it live under one roof. It runs on any AI provider you choose, including models on your own hardware, because the point of owning your business is not conditional on which lab shipped the best weights this quarter.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.16',
    text: 'What this actually unlocks',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.17',
    text: 'Here is where I will say the part that sounds too big, because I believe it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.18',
    text: 'The reason to want owned, governed agents is not developer productivity. It is that they collapse the distance between having an interest and running a business.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.19',
    text: 'Most people never start because the operating is the wall. Not the idea, not the craft, not the customers. The invoicing, the scheduling, the follow-up emails, the catalog updates, the hundred small operations that make a business a business. Big companies buy their way through that wall with headcount. Everyone else gives up or burns out.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.20',
    text: 'Agents that you own and can verify tear that wall down. A person with a real interest and no operations team gets to run a real business. The human does the choosing. The agents do the operating. The receipts keep everyone honest. That is what I mean when I say humans and AI agents build businesses from creative expression. The expression is yours. The machinery finally is too.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.21',
    text: "And because it all runs on infrastructure you own, it compounds. The memory your agents accumulate is yours. The content, the customer history, the audit record of every decision: yours. Today's work becomes an input to tomorrow's work instead of evaporating into a vendor's database. Do that for years and what you have is not a subscription you are afraid to cancel. It is an asset. Something you can hand to your kids, or sell, or just keep running. A digital legacy, built one creative expression at a time.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.22',
    text: 'I want to be precise about the present tense, because this industry has a lying problem and I refuse to add to it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.23',
    text: 'Today, RevealUI is the runtime layer of that thesis. Five primitives that every business needs: People, Content, Offers, Payments, Agents. One permission model that covers humans and agents alike. A tamper-evident audit log. Local-first AI that runs on models you own, with any provider you choose as an option rather than a dependency. It is open source, and you can read every line.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.24',
    text: 'Today, you still need to be the kind of person who can run your own infrastructure. The owner-operators come first: the founders and small teams who run their business on their own AI and want the receipts to prove what it did. They are who this is built with, right now, in production, by the one engineer in Tennessee writing this.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.25',
    text: "I can tell you the receipts matter because I run on them. For the past several months this company has been operated by me and a fleet of AI agents working around the clock: agents that write code, review each other's pull requests, file the paperwork, and hand work to each other between sessions like a shift change. Hundreds of merged pull requests have moved through that system. And the moments that taught me the most were not the wins. Twice, an agent marked a bug as fixed because the code had merged, and the record showed that nobody had ever watched it actually work. The fix for that was not a smarter model. It was a rule that a claim without evidence does not close, and a ledger nobody can quietly edit. Just today, an agent refused an instruction that arrived through a side channel under my name, because the provenance did not check out. That is governance doing its job. I trust my agents the way I trusted the teams I managed for a decade: exactly as far as the records go.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.26',
    text: 'The non-technical future I just described is the horizon, not the current release. I am not going to pretend otherwise. But every piece of it depends on the same two preconditions, and those are built. Proof and ownership do not get easier to retrofit later. They are the foundation or they are nowhere.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.27',
    text: "The UI of the future has yet to reveal itself. When it does, I do not believe it will look like a smarter chat window in somebody else's cloud. It will look like your own business, running under your own roof, operated by a workforce you can audit, compounding into something that outlasts the tools that built it.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.28',
    text: 'That is what we are building toward. One receipt, one primitive, one creative expression at a time.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/ui-of-the-future',
    exportPath: 'body.29',
    text: 'If you want to see where it stands today, the code is public and the runtime is free to self-host. Start there. Read the receipts.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/16-ui-of-the-future.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.0',
    text: 'Most tools sell you a library. You install it, wire it into one corner of your app, and move on. RevealUI is built the other way around. It is a runtime that an entire family of products sits on top of, each one solving a problem you hit the moment you start running software for real.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.1',
    text: 'We call the family RevFleet. RevealUI is the flagship: the agentic business runtime that gives you People, Content, Offers, Payments, and Agents pre-wired into one deployable system. The other seven products are the tools we built to operate it, and we ship every one of them.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.2',
    text: 'This post is the map. It is also honest about where each product is, because "shipping" means different things at different stages, and you deserve to know which is which before you build on it.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.3',
    text: 'Every product carries one of four status badges. They mean exactly what they say:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.4',
    text: '**Beta** -- production-ready code, dogfooded daily, limited real users.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.5',
    text: '**Alpha** -- works and ships, development-preview quality, may break.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.6',
    text: '**Active (MIT)** -- a released, free, open library, no support guarantees.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.7',
    text: '**Planned** -- code-complete or scaffolded, not yet shipped to users.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.8',
    text: 'No product on this page hides behind a vaguer word than that.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.9',
    text: '**RevealUI** (Beta) is the foundation everything else builds on. The five primitives, People, Content, Offers, Payments, and Agents, are pre-wired into a single runtime that your team and your AI agents share through one open protocol. Standard Postgres for data, S3-compatible object storage, real-time sync, a typed REST API with an OpenAPI spec, session auth, and feature gating, all in the box.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.10',
    text: 'You can run a real business on the open-source core today. Start here. Add the rest of the fleet as you grow into it.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.11',
    text: 'Each of these came out of operating RevealUI ourselves. We needed them, so we built them, then made them products.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.12',
    text: '**RevVault** (Beta) is an age-encrypted secret vault. A Rust CLI plus a Tauri desktop app keep your credentials encrypted on hardware you control, never in a vendor dashboard and never as plaintext on disk. It is the canonical secret store for every project in the fleet. There is a whole post on why your secrets do not belong in a `.env` file.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.13',
    text: '**RevForge** (Beta) is a white-label stamping tool for operators. It generates branded, domain-locked RevealUI trial kits as self-hosted runtime instances, so an agency or platform can hand a customer their own deployment without forking anything by hand.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.14',
    text: '**RevDev** (Alpha) is a multi-agent IDE harness: a desktop Studio, a terminal Console, and a Node daemon that coordinate AI coding agents across a multi-repo workspace. It speaks to Claude, Cursor, and Copilot through a shared coordination layer. Alpha means it works and we use it, not that it is bulletproof yet.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.15',
    text: '**RevCon** (Alpha) is editor config sync. One source of truth for Zed, VS Code, and Cursor settings, symlinked into every project, so you edit a config once and it propagates fleet-wide.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.16',
    text: '**RevSkills** (Active, MIT) is a library of Claude Code skills: auth flows, schema patterns, test scaffolds, and more, ready to drop into any agent. Free, open, importable.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.17',
    text: '**RevMarket** (Planned, [#451](https://github.com/RevealUIStudio/revealui/issues/451)) is the agent tool marketplace. The runtime already ships a catalog of first-party integrations out of the box; RevMarket is the planned layer where third-party developers publish and discover MCP servers and agent capabilities. It is designed, not yet open to outside publishers, and we say so plainly on the roadmap.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.18',
    text: 'Why a fleet instead of one big product',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.19',
    text: 'The temptation, building this, was to fold everything into one monolith and call it a platform. We did the opposite on purpose.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.20',
    text: 'Each product is useful on its own. RevVault secures secrets for any project, RevealUI runtime or not. RevSkills drops into any Claude Code setup. Bundling them would have made each one worse, locked behind a runtime you may not want yet.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.21',
    text: 'So they compose instead of couple. You can take exactly the piece you need today, and the rest is there when you need it. One foundation, eight products, no all-or-nothing.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/revfleet-product-family',
    exportPath: 'body.22',
    text: '*RevealUI is the open runtime for businesses that run their own AI. See the whole RevFleet lineup and current status at [revealui.com/products](https://revealui.com/products), or start with the runtime: `npx create-revealui`.*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/11-revfleet-product-family.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.0',
    text: 'The fastest admin interface is a sentence.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.1',
    text: '"Draft a post about our Q2 launch and save it as a draft." "How many users signed up last week?" "Mark every ticket from the demo account as resolved." In the RevealUI admin, you type that into a chat panel and the agent does it, in front of you, with every step it takes visible as it happens.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.2',
    text: 'This is Dashboard Agent Chat, and it ships today in the admin dashboard.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.3',
    text: 'The agent lives inside the admin you already use. From the chat panel it can create and edit content, query your data, manage collections, and run multi-step workflows, all through natural language. You get streaming responses so you see the work as it unfolds, full visibility into which tools it called, and a conversation history so you can pick up where you left off.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.4',
    text: 'It is not a chatbot bolted onto a sidebar that can only answer questions. It operates your business, on the same data, through the same API your team uses.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.5',
    text: 'Why it works: collections are already tools',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.6',
    text: 'The reason this needed almost no new surface area is the architecture underneath. In RevealUI, every collection you define is automatically exposed as a tool an agent can call. Define a `Posts` collection and you get a REST API, an admin UI, and an agent-callable tool, simultaneously, from one definition.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.7',
    text: 'So when you ask the agent to draft a post, it is not reaching through a special integration. It is calling the exact same create-post operation a human triggers from the dashboard. There is no separate "agent path" to keep in sync with the real one.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.8',
    text: "That last part matters, and it is also today's limitation. The agent does not get its own identity or its own policy check; it runs with exactly the same permissions as the account or session that launched it, nothing more and nothing less. Per-agent policy scoping through the RBAC + ABAC engine, and a full audit trail of what the agent did, are not shipped yet.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.9',
    text: "It runs on your models, not someone's API",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.10',
    text: 'The agent streams its work over Server-Sent Events, and the inference behind it is yours to choose. RevealUI auto-detects the inference path at runtime, preferring a local Ubuntu Inference Snap and falling back to Ollama, both running open-weight models on your own hardware.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.11',
    text: 'No proprietary API key. No per-token cloud bill. No customer data leaving your machine to reach a frontier model. If you would rather point it at a cloud-compatible endpoint, that is a single environment variable, but it is opt-in, never the default.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.12',
    text: 'Dashboard Agent Chat is a Pro-tier feature. The AI engine that powers it loads only for licensed deployments, so a free-tier install never pulls the agent code into memory at all.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.13',
    text: 'And because it runs on open-weight models by design, set your expectations accordingly. These models are excellent at the structured work an admin is full of: drafting and editing content, querying and summarizing data, filling fields, orchestrating a sequence of API calls. They are not a frontier reasoning engine, and we would rather you know that than be surprised by it. For the daily operation of a business, structured and reliable is exactly the right trade.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.14',
    text: 'Spin up a RevealUI instance, open the admin, and ask it to do something. Watching your admin act on a plain-English instruction, with every tool call shown and every permission respected, is the moment the "agentic business runtime" stops being a tagline and starts being a tool you reach for.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/dashboard-agent-chat',
    exportPath: 'body.15',
    text: '*RevealUI is the open runtime for businesses that run their own AI. See what the admin can do in the [docs](https://docs.revealui.com), or compare tiers on the [pricing page](https://revealui.com/pricing).*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/15-dashboard-agent-chat.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.0',
    text: 'The `.env` file is where security quietly rots.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.1',
    text: 'It starts innocently. You paste a Stripe key into `.env.local` to get a feature working. A teammate copies it into Slack to unblock themselves. CI needs it, so it goes into the provider dashboard too. Six months later your most sensitive credentials exist in plaintext in four places, none of them encrypted, and nobody remembers all four. The day one of them leaks, you find out from a billing alert.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.2',
    text: 'RevealUI refuses that bargain. Every project in the fleet keeps its secrets in **RevVault**, an age-encrypted local secret store, and nothing lives in plaintext on disk.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.3',
    text: 'RevVault is a Rust command-line tool plus a Tauri desktop app. It encrypts your secrets with [age](https://age-encryption.org/), keeps them on your own filesystem, and never phones home. The encrypted store is git-friendly, so a team can version it like any other file, and it is compatible with the `passage` format, so you are not locked into a bespoke vault you cannot leave.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.4',
    text: 'The model is simple. Secrets are encrypted at rest. They are decrypted on demand, in memory, by a key that stays on your machine. They are never written back to disk in the clear, and they never transit a third-party server you do not control.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.5',
    text: 'How a RevealUI project actually uses it',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.6',
    text: 'The point of RevVault is that you stop thinking about secrets day to day, and they are still never exposed.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.7',
    text: 'Every RevealUI project ships an `.envrc` that calls RevVault at shell entry. When you `cd` into the project, your credentials are decrypted into the environment for that session, used by the running process, and gone when the shell exits. No `.env.local` full of live keys sits on disk waiting to be committed by accident.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.8',
    text: 'Contrast that with the standard pattern: secrets in a provider\'s secret manager, secrets in a `.env` checked into a "private" repo, secrets pasted into a CI settings page. All three hand values that should only exist on hardware you control to someone else, and all three are one misconfiguration away from public.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.9',
    text: 'The desktop app, for when the CLI is not enough',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.10',
    text: 'Not everyone wants to live in a terminal. The RevVault desktop app gives you a visual view of your namespaces, lets you add and rotate secrets without memorizing commands, and keeps the same age-encrypted store underneath. The CLI and the app are two front doors to one vault, not two systems to keep in sync.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.11',
    text: 'RevVault is Beta. It is what the entire fleet runs on every day, which is the strongest test we can give it, but a few things are worth knowing before you adopt it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.12',
    text: 'You hold the age identity key. That is the whole point, and it is also a responsibility: lose the key with no backup and you lose the secrets it protects, exactly as it should be for something nobody else can decrypt. The CLI is intentionally conservative about destructive operations, so renaming and bulk deletion are deliberate rather than one keystroke away. And like the rest of RevFleet, it is open, so you can read precisely what it does with your data before you trust it with any.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.13',
    text: 'The trade you are making is real surface area, your own key and your own store, in exchange for the one thing a vendor dashboard can never give you: secrets that only ever exist where you put them.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-secrets',
    exportPath: 'body.14',
    text: '*RevealUI is the open runtime for businesses that run their own AI. RevVault is part of the RevFleet family; read the source and get started on [GitHub](https://github.com/RevealUIStudio/revvault).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/12-own-your-secrets.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.0',
    text: 'There is a rule across the entire RevFleet codebase that surprises people: no hand-written regular expressions. Not "use them sparingly." Zero authored regex, enforced in CI.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.1',
    text: 'This sounds like an aesthetic preference. It is actually a security and maintainability decision, and it has paid for itself many times over.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.2',
    text: 'Why regex is a liability, not a tool',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.3',
    text: 'A regular expression is write-only code. You write one that works on your three test cases, ship it, and a year later nobody on the team, including the author, can say with confidence what it accepts and what it rejects. Bugs hide in the gap between what you meant and what the pattern actually matches.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.4',
    text: 'Worse, some regex patterns are a denial-of-service vector. Catastrophic backtracking lets a short, innocent-looking input pin a CPU core for seconds:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.5',
    text: 'That pattern is the kind of thing that ends up in an input validator, looks fine in review, passes the tests, and becomes an outage the first time an attacker sends a crafted string. Banning the whole category removes the foot-gun instead of hoping every reviewer spots it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.6',
    text: 'For every job regex usually does, there is a clearer, safer tool that says what it means:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.7',
    text: '**Parsing structured text** uses real parsers. `URL` for URLs, `JSON.parse` for JSON, `Date.parse` for dates. These follow the language specs, and they reject malformed input correctly instead of approximately.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.8',
    text: '**Walking code and markup** uses AST walkers. We use `mdast` for Markdown, the Lexical tree for rich text, and `@typescript-eslint` for TypeScript. An AST knows the difference between a string literal and an identifier; a regex only sees characters.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.9',
    text: '**Membership and lookup** uses `Set` and `Map`. "Is this one of the allowed values" is a `Set.has`, not an alternation you have to keep escaping.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.10',
    text: '**Splitting human text** uses `Intl.Segmenter`, which understands graphemes and word boundaries across languages, where a regex quietly mangles anything outside ASCII.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.11',
    text: '**Simple shape checks** use typed predicates: `startsWith`, `endsWith`, `includes`, and small hand-written functions that a human can read in one pass.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.12',
    text: "Library APIs that happen to wrap a tested pattern are fine. Zod's `.email()` is a typed contract, not a regex you maintain. The line is about regex you author and own, because that is the regex that bites you.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.13',
    text: 'The one exception, kept on a short leash',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.14',
    text: "Some third-party tools only accept configuration as a regex string: a linter ignore pattern, a scanner allowlist. We do not pretend those away. Each one is marked with a `// REGEX-CONFIG-BOUNDARY` comment, kept as small as possible, and isolated so it is obvious it is a boundary with someone else's API, not logic we wrote.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.15',
    text: 'How the rule pays off in practice',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.16',
    text: 'The most satisfying proof is the tooling that enforces our own claims. The validator that keeps our marketing numbers honest has to count things in the repo, like how many test cases live in a suite. The obvious implementation is a regex over the file. Ours is not:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.17',
    text: 'Anyone can read that and know exactly what it counts. There is no pattern to misremember, no edge case lurking in a quantifier, and nothing for a malicious input to exploit. We have an AST-based analyzer in CI that hunts for the dangerous patterns regex tends to hide, command injection, time-of-check-to-time-of-use races, and ReDoS, and the no-regex rule means it has far less to hunt for.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.18',
    text: 'The honest cost is line count. A typed predicate or a small parser-driven function is sometimes longer than the one-liner regex it replaces. We take that trade every time, because the longer version is the one a teammate can read at 11pm before a launch and actually trust.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.19',
    text: 'Readable, reviewable, and safe beats clever and opaque. For code you intend to run for years, that is not a close call.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/zero-regex',
    exportPath: 'body.20',
    text: '*RevealUI is the open runtime for businesses that run their own AI. Read how we build it in the [docs](https://docs.revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/13-zero-regex.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.0',
    text: 'Marketing numbers rot. A landing page says "65 components," the team ships four more, and now the page is wrong and nobody notices, because the page and the code live in different worlds and no one is paid to keep them in sync.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.1',
    text: 'On revealui.com, that cannot happen. Every count we publish is checked against the actual code on every push, and if a number drifts from the truth, the build fails before the change can merge. The marketing site is not allowed to lie.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.2',
    text: 'The problem with hand-written stats',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.3',
    text: 'Pick any developer-facing site and you will find stale numbers. "Over 200 integrations" when it has been 340 for a year. "12 supported languages" when two were removed. The numbers were true once, typed by hand into a hero section, and then reality moved and the copy did not.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.4',
    text: 'It is not malice, it is structure. The claim and the thing it describes have no connection. Keeping them aligned depends on someone remembering, and someone always forgets.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.5',
    text: 'One canonical source, imported everywhere',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.6',
    text: 'The first half of the fix is a single source of truth. Every number the marketing site can state lives in one typed object, and no page is allowed to hardcode the integer anywhere else.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.7',
    text: 'A page that wants to say "65 UI components" imports `METRICS.uiComponents`. It never types `64`. Change the underlying number in one place and the copy follows automatically, on the marketing site, in the docs, and in the product roadmap, with no copy edit at all.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.8',
    text: 'The validator that does the counting',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.9',
    text: 'The second half is a check that proves those numbers are real. On every push, a claim-drift validator walks the docs and the marketing content, finds every place a number sits next to a noun it recognizes, and counts the real thing in the repository. The counts come straight from the source: it reads the components directory, the MCP servers directory, the database schema, and the test suites, and compares each published claim against the live count.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.10',
    text: 'If they match, the build is green. If they do not, it fails loudly with the exact mismatch:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.11',
    text: 'That hard failure is the whole point. The numbers you read here are not a snapshot someone updated when they remembered. They are a measurement of the code as it exists right now: 31 packages, 65 UI components, 13 first-party MCP servers, 101 database tables, 60 access-control enforcement tests, 5 starter templates. Each one is checked on the commit that publishes it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.12',
    text: 'The validator practices what we preach',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.13',
    text: 'There is a detail worth calling out. The fleet has a rule against hand-written regular expressions, and the claim-drift validator obeys it. It does not scan files with clever patterns. It splits text into lines, trims them, and uses plain string checks and real parsers to find claims and count code. It even skips fenced code blocks, so the example error message above does not trip the validator on this very page.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.14',
    text: 'So the tool that keeps our marketing honest is itself built to the same standard it enforces: readable, reviewable, and impossible to quietly fool.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.15',
    text: 'This is more discipline than most marketing sites accept, and that is exactly why it is worth writing about. A number you can verify is a number you can trust, and a company that wires "verify before you claim" into its build pipeline is telling you something about how it writes the rest of its code too.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.16',
    text: 'We would rather break our own build than ship a stat we cannot stand behind.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/claim-drift',
    exportPath: 'body.17',
    text: '*RevealUI is the open runtime for businesses that run their own AI. Every claim on this site is checked against the source; read it for yourself in the [docs](https://docs.revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/14-claim-drift.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.0',
    text: "Open the `package.json` of a typical React app and trace the dependency tree under your UI. A component library. The headless-primitive library it sits on. An icon set. A class-merging utility. A variants helper. A few polyfills the library pulls in. Every one of those is a version you have to track, a breaking change you have to absorb on someone else's schedule, and a styling opinion you have to work around.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.1',
    text: "RevealUI's UI layer, `@revealui/presentation`, has exactly one third-party runtime dependency. Not one UI framework. One npm package: `tailwind-merge`. Its design tokens come from a sibling in-house package, `@revealui/tokens`. Everything else, the 65 components and the machinery that powers them, is in the box and MIT licensed.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.2',
    text: 'This post is about why a component library should be something you own outright, and how this one is built.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.3',
    text: 'The cost of "just use a component library"',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.4',
    text: "Component libraries are a good trade right up until they aren't. You move fast for six months. Then the library ships a major version that rewrites its theming API, and your design tokens stop resolving. Or the headless primitive it depends on changes its focus-management behavior and your dialog starts trapping keyboard focus in the wrong place. Or you need a component the library does not have, so you bolt on a second library, and now two different abstractions own your markup.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.5',
    text: "The deeper problem is that the most important layer of your product, the part your users actually touch, is code you did not write and cannot change without forking. When something renders wrong at 11pm before a launch, you are reading someone else's source in `node_modules` hoping you can monkey-patch your way out.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.6',
    text: 'I have done that enough times to want a different deal.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.7',
    text: '`@revealui/presentation` is 65 native React components. Not wrappers around another library. Components, built directly on Tailwind v4 and React.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.8',
    text: 'The set is meant to cover real business software, not just a demo: `accordion`, `alert`, `avatar`, `badge`, `breadcrumb`, `callout`, `card`, `checkbox`, `code-block`, `combobox`, `dialog`, `drawer`, `divider`, `description-list`, and on through the list. Form controls, overlays, navigation, data display. The pieces you reach for on day one and the ones you need in month three.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.9',
    text: 'The dependency story is the headline:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.10',
    text: '**One third-party runtime dependency:** `tailwind-merge`, for safely merging Tailwind class lists. Design tokens come from the in-house `@revealui/tokens` package, not from npm.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.11',
    text: '**React is a peer dependency**, not a bundled copy. The package works on React 18 or 19; RevealUI runs it on 19.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.12',
    text: '**Tailwind v4** for styling.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.13',
    text: 'That is the whole external surface. There is no component framework underneath.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.14',
    text: 'It is worth being specific, because "zero dependencies" is a claim people make loosely. Search the source of `@revealui/presentation` for Radix, MUI, Headless UI, Chakra, or React Aria and you will find nothing. There is no `class-variance-authority` either, which is the one most projects keep even after they drop the rest.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.15',
    text: 'The three things those libraries usually provide are all in-package:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.16',
    text: 'The **variant system** (`cva`) and the **class-merge helper** (`cn`) live in `packages/presentation/src/utils/cn.ts`.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.17',
    text: 'The **polymorphic `Slot`** that powers the `asChild` pattern lives in `packages/presentation/src/primitives/Slot.ts`.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.18',
    text: 'So a component imports its tooling from inside the package, not from npm:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.19',
    text: 'If a variant behaves wrong, the fix is in your tree, not in a dependency you are pinned to.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.20',
    text: 'Variants without the dependency',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.21',
    text: 'The API will feel familiar if you have used `class-variance-authority`, because that is the shape worth keeping. You define variants, you get a typed `VariantProps`, and the merge helper makes sure a caller-supplied `className` wins cleanly over the defaults instead of producing two conflicting Tailwind classes.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.22',
    text: 'The `asChild` pattern works the same way it does in the libraries that popularized it. Pass `asChild` and the component renders its child instead of its own element, forwarding props and merging classes through the in-house `Slot`. A `Button` becomes a link without losing its styling or its keyboard behavior:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.23',
    text: 'You get the ergonomics. You do not get the dependency.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.24',
    text: 'Headless when you want behavior, not styling',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.25',
    text: 'Some components ship in two forms. Alongside `Button` and `Checkbox` there is `button-headless` and `checkbox-headless`: the behavior, state, and accessibility wiring with none of the visual opinion. When the default styling is not what you want, you drop down a level and bring your own classes, without giving up focus management, ARIA attributes, and keyboard handling.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.26',
    text: 'That split matters for a framework. The styled components get you to a working product fast. The headless ones mean you never hit a wall where the only way forward is to rip the library out.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.27',
    text: 'Theming is tokens, not hardcoded colors',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.28',
    text: "Colors are not baked into the components. They resolve through a semantic design-token layer in `tokens.css`: `bg-background`, `text-foreground`, `border-border`, `text-primary`, and so on. The tokens carry RevealUI's cobalt palette and adapt to light and dark. Retheme the whole system by changing the token values in one place; you do not touch 65 component files to change your brand color.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.29',
    text: 'Because the tokens are semantic rather than literal, a component never says "blue." It says "primary," and the token decides what primary means in the current theme.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.30',
    text: 'Here is the honest version. A from-scratch component layer trades away two real things: the ecosystem breadth of a Radix or an MUI, and the millions of hours of edge-case hardening that a widely used library accumulates. If you need an exotic widget that is not among the 60, you build it, on the same primitives, rather than `npm install`-ing it in an afternoon.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.31',
    text: "What you get back is ownership. No major-version migrations dictated by someone else's roadmap. No dependency that can change behavior under you. No styling you cannot reach. For business software, where the component needs are broad but not exotic, that is the trade I want, and it is the one RevealUI makes by default.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 31' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.32',
    text: "The component layer is MIT licensed, like the rest of RevealUI's core. It ships with every `npx create-revealui`, it renders RevealUI's own apps, and you can fork any component in it without asking anyone. The UI your users touch should be code you control. This is that code.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 32' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.33',
    text: 'Build your business, not your boilerplate.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 33' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/component-library',
    exportPath: 'body.34',
    text: '*RevealUI is the open runtime for businesses that run their own AI. The component layer is MIT licensed and ships with every install. Get started with `npx create-revealui`, or read the [docs](https://docs.revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/09-component-library.md', note: 'body source paragraph 34' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.0',
    text: 'Most "modern data stacks" charge a quiet tax: lock-in. The database speaks a proprietary dialect, so your queries do not move. The file storage is a vendor blob API with no standard underneath, so your uploads do not move. Real-time sync is a separate SaaS you wire in by hand, so your live data lives somewhere you do not control. Each choice is reasonable on its own. Together they mean that the day you want to leave, you cannot.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.1',
    text: 'RevealUI takes the opposite position on every one of those. The database is standard Postgres. The object storage speaks the S3 API. Sync ships in the box. None of it is proprietary, and all of it is portable. This post walks the data layer and the one test that matters: can you leave?',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.2',
    text: 'Standard Postgres, not a proprietary database',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.3',
    text: 'RevealUI runs on Postgres. Specifically NeonDB, which is Postgres, the real thing, with the standard wire protocol and `pg_dump` that does exactly what you expect. The schema is 101 tables defined with Drizzle ORM, typed end to end, and it is not hiding any vendor-only behavior in the hot path.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.4',
    text: 'That choice has a few consequences worth naming:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.5',
    text: 'Your queries are SQL. They run on Neon today and on any other Postgres tomorrow, managed or self-hosted, without a rewrite.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.6',
    text: 'Your data is a `pg_dump` away from being somewhere else. There is no export API to beg for and no proprietary format to reverse-engineer.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.7',
    text: 'The schema is in your repo, in TypeScript, versioned with migrations. You can read it, diff it, and own it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.8',
    text: "New features are built to stay portable on purpose: the project is mid-migration off an earlier Supabase dependency, and the rule for new code is that it must not depend on any one provider's Postgres extensions. Standard first.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.9',
    text: 'Object storage you can move',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.10',
    text: 'Files, images, and uploads go to Cloudflare R2, which is S3-compatible. That hyphenated word is the whole point. R2 is the canonical backend (the old Vercel Blob integration was retired), but the code talks to it through the S3 API, the same API that AWS S3, MinIO, and a dozen other stores speak.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.11',
    text: 'So the storage layer passes the same test the database does. Point the S3 credentials at a different provider and your application does not notice. Your media is not trapped behind a vendor SDK with no standard under it. It is objects in a bucket, addressable the way object storage has been addressable for fifteen years.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.12',
    text: 'Real-time sync, in the box',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.13',
    text: 'This is the piece most stacks bolt on later, and the one RevealUI ships with: `@revealui/sync`. It is a real-time sync layer that wraps ElectricSQL for syncing Postgres data to clients and Yjs CRDTs for collaborative editing. Out of that you get an offline queue, a shape cache, conflict resolution, and collaborative documents, without standing up a separate real-time service.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.14',
    text: 'The model is worth understanding because it is not websockets-and-hope. ElectricSQL syncs defined "shapes" of your Postgres data to the client and keeps them live, so the client reads from a local copy that stays current. Yjs handles the case where two people edit the same thing at once, merging changes with conflict-free data types instead of last-write-wins. The offline queue means a client that loses its connection keeps working and reconciles when it comes back.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.15',
    text: 'It is the same Postgres from the first section. Sync is a layer over data you already own, not a second source of truth you have to keep in step by hand.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.16',
    text: 'Rich text is data, not markup',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.17',
    text: 'Content in RevealUI is stored as structured Lexical JSON, not as a blob of HTML. That keeps the door open the same way the rest of the stack does. Because the content is data, it renders on the server without a browser, it can be queried and transformed, and it is not married to one front end. The server-side renderer also sanitizes every URL before it emits anything, so stored content cannot smuggle a `javascript:` link into a page.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.18',
    text: 'Structured content is portable content. You can move it, re-render it somewhere else, or feed it to something that is not a browser at all, which matters more every month that agents read your data instead of people.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.19',
    text: 'Here is the test I apply to any stack I am asked to trust: if I wanted to leave, what would it take? For most "modern" stacks the honest answer is a rewrite, a data-export project, and a few weeks of praying the proprietary features have equivalents.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.20',
    text: 'For this one the answer is `pg_dump`, an S3 bucket copy, and standard protocols on both ends. That is not an accident or a side effect. It is the design goal. Portability is not a feature you add later; it is a property you either build in from the schema up or you do not have at all.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.21',
    text: 'The honest cost: you are running a Postgres database and an object store, not a single magic box that hides both behind one bill and one dashboard. There is a little more surface area than an all-in-one platform, and you are responsible for the credentials to each piece (RevealUI keeps those in an encrypted local vault rather than scattered across `.env` files, which helps).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.22',
    text: 'What you get back is the thing the all-in-one platforms cannot sell you: the ability to walk away. Standard Postgres, S3-compatible storage, sync built on open protocols, content stored as data. Every layer is one you could re-host yourself. For software you intend to run for years, that is the trade worth making.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.23',
    text: 'Build your business, not your boilerplate.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/own-your-data',
    exportPath: 'body.24',
    text: '*RevealUI is the open runtime for businesses that run their own AI. The data layer is MIT licensed and ships with every install. Get started with `npx create-revealui`, or read the [docs](https://docs.revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/10-own-your-data.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.0',
    text: '**Build a complete business application with auth, content, and payments - faster than you can order lunch.**',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.1',
    text: 'RevealUI is the open runtime for businesses that run their own AI. Instead of gluing together a dozen SaaS tools and spending weeks on boilerplate, you get People, Content, Offers, Payments, and Agents pre-wired and ready to deploy.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.2',
    text: 'This tutorial walks you through creating a real business application from scratch. By the end, you will have a working admin with typed collections, session-based authentication, a REST API with Swagger documentation, Stripe billing, license enforcement, and an admin dashboard - deployed to production on Vercel.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.3',
    text: 'Before you begin, make sure you have the following installed and ready:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.4',
    text: '**Node.js 24+**  -  check with `node --version`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.5',
    text: '**pnpm 10+**  -  check with `pnpm --version` (install with `corepack enable && corepack prepare pnpm@latest --activate`)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.6',
    text: '**A Stripe account**  -  [test mode](https://dashboard.stripe.com/test/apikeys) is fine for this tutorial',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.7',
    text: '**A NeonDB account**  -  the [free tier](https://neon.tech) works perfectly',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.8',
    text: '**Tip:** If you already have Node.js but not pnpm, the fastest path is `corepack enable`  -  it ships with Node.js and activates pnpm instantly.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.9',
    text: 'Step 1: Scaffold your project',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.10',
    text: 'Run the `create-revealui` initializer:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.11',
    text: 'The CLI walks you through an 8-step setup wizard:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.12',
    text: 'Select **Basic Blog** for this tutorial. It comes with a Posts collection, sample content, and a clean starting point.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.13',
    text: 'The wizard continues through database, storage, payment, and dev environment setup:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.14',
    text: '**Tip:** You can skip all prompts and use defaults with `npx create-revealui@latest my-business -y`. You can also pre-select a template: `npx create-revealui@latest my-business --template e-commerce`.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.15',
    text: 'Step 2: Configure your environment',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.16',
    text: 'The CLI generates a `.env.development.local` file with your credentials already filled in (if you provided them during setup). If you chose "Skip" for any step, or want to configure things manually, here is the full structure:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.17',
    text: 'Here is where to find each value:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.18',
    text: '| Variable | Where to get it | |----------|----------------| | `REVEALUI_SECRET` | Auto-generated by the CLI. To generate one manually: `openssl rand -hex 32` | | `POSTGRES_URL` | [NeonDB Console](https://console.neon.tech) - create a project, copy the connection string from the dashboard | | `R2_ACCOUNT_ID` | [Cloudflare Dashboard](https://dash.cloudflare.com) - the account ID shown on the R2 overview page | | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare Dashboard - R2 → Manage R2 API Tokens → Create API Token (S3-compatible credentials) | | `R2_BUCKET` | The name of the R2 bucket you created | | `R2_PUBLIC_BASE_URL` | A bound custom domain (e.g. `https://media.your-domain.com`) or the dev URL `https://<account-id>.r2.cloudflarestorage.com/<bucket>` | | `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) - the key starting with `sk_test_` | | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same Stripe page - the key starting with `pk_test_` | | `STRIPE_WEBHOOK_SECRET` | Generated when you create a webhook endpoint (covered in Step 7) |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.19',
    text: '**Warning:** Never commit `.env.development.local` to git. The CLI adds it to `.gitignore` automatically, but double-check before pushing.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.20',
    text: 'Step 3: Initialize the database',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.21',
    text: 'With your `POSTGRES_URL` set, initialize the database schema:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.22',
    text: 'Then run migrations to create all tables:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.23',
    text: 'Finally, seed it with sample content:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.24',
    text: 'The seed script creates three sample blog posts - two published and one draft - so you have content to work with immediately.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.25',
    text: '**Note:** The seed script posts content via the REST API, so you will need the dev server running first (Step 4) if seeding separately. During initial setup, the CLI handles the order for you.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.26',
    text: 'Start the full development stack:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.27',
    text: '| Service | URL | What it does | |---------|-----|-------------| | **Admin Dashboard** | [http://localhost:4000/admin](http://localhost:4000/admin) | Admin dashboard - manage collections, users, and settings | | **Admin API** | [http://localhost:4000/api](http://localhost:4000/api) | Auto-generated REST API for all your collections | | **API Server** | [http://localhost:3004](http://localhost:3004) | Standalone API with OpenAPI spec | | **Swagger Docs** | [http://localhost:3004/docs](http://localhost:3004/docs) | Interactive API documentation |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.28',
    text: 'Open [http://localhost:4000/admin](http://localhost:4000/admin) in your browser. You should see the RevealUI admin login screen.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.29',
    text: '**Tip:** Each app can be started independently. Use `pnpm dev:admin` for just the admin, or `pnpm dev:api` for just the API server.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.30',
    text: 'Step 5: Create your first collection',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.31',
    text: 'The scaffold already created a Posts collection for you. Open `revealui.config.ts` in the project root:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 31' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.32',
    text: 'Now look at the Posts collection in `src/collections/Posts.ts`:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 32' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.33',
    text: 'This single file gives you a fully typed collection with five fields. RevealUI automatically generates REST API endpoints for it:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 33' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.34',
    text: '| Method | Endpoint | Description | |--------|----------|-------------| | `GET` | `/api/posts` | List all posts (with pagination and filtering) | | `GET` | `/api/posts/:id` | Get a single post by ID | | `POST` | `/api/posts` | Create a new post | | `PATCH` | `/api/posts/:id` | Update a post | | `DELETE` | `/api/posts/:id` | Delete a post |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 34' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.35',
    text: 'Try it now - fetch your seeded posts:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 35' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.36',
    text: "Let's add a new collection. Create `src/collections/Pages.ts`:",
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 36' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.37',
    text: 'Register it in `revealui.config.ts`:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 37' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.38',
    text: 'Save the file, and the dev server hot-reloads. You now have `/api/pages` with full CRUD and the access control rules you defined - no extra wiring needed.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 38' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.39',
    text: 'Step 6: Add authentication',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 39' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.40',
    text: 'Open the admin dashboard at [http://localhost:4000/admin](http://localhost:4000/admin) and create your first admin account. Fill in an email and password (minimum 12 characters).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 40' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.41',
    text: 'After signing up, RevealUI creates a session cookie (`revealui-session`) that authenticates all subsequent requests. This is session-based auth - no JWT tokens, no refresh token dance. The cookie is:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 41' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.42',
    text: '`httpOnly`  -  JavaScript cannot read it',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 42' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.43',
    text: '`secure`  -  only sent over HTTPS (in production)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 43' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.44',
    text: '`sameSite=lax`  -  prevents CSRF attacks',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 44' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.45',
    text: 'To verify access control is working, try accessing a protected endpoint without authentication:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 45' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.46',
    text: "Now try with your session cookie (copy it from your browser's dev tools):",
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 46' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.47',
    text: 'Access control is enforced at the database query level - there is no way to bypass it from the API.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 47' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.48',
    text: 'RevealUI handles Stripe integration out of the box - products, checkout sessions, subscriptions, and webhook processing.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 48' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.49',
    text: '7a. Set up the Stripe CLI for local webhook testing',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 49' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.50',
    text: 'The Stripe CLI prints your webhook signing secret:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 50' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.51',
    text: 'Copy that value into your `.env.development.local`:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 51' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.52',
    text: 'Restart your dev server to pick up the new environment variable.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 52' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.53',
    text: '7b. Create a Stripe product with tier metadata',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 53' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.54',
    text: 'In the [Stripe Dashboard](https://dashboard.stripe.com/test/products), create a new product:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 54' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.55',
    text: '**Price:** $49/month (recurring)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 55' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.56',
    text: '**Metadata:** Add a key `revealui_tier` with value `pro`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 56' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.57',
    text: 'The `revealui_tier` metadata key is what RevealUI uses to map Stripe products to license tiers. Valid tiers are `free`, `pro`, `max`, and `enterprise`.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 57' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.58',
    text: 'RevealUI exposes a checkout API. Create a test checkout session:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 58' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.59',
    text: "Open that URL to complete the test checkout. Use Stripe's test card number `4242 4242 4242 4242` with any future expiry date and any CVC.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 59' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.60',
    text: 'After checkout completes, the webhook fires and RevealUI automatically:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 60' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.61',
    text: 'Generates a license key tied to the customer',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 61' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.62',
    text: "Maps the `revealui_tier` metadata to the user's license tier",
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 62' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.63',
    text: 'Activates feature gating for that tier',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 63' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.64',
    text: 'You can verify it worked in the admin dashboard under the Licenses section, or via the API:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 64' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.65',
    text: 'Your application is ready for production. Deploy it with three commands:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 65' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.66',
    text: 'Pull your environment variables to Vercel (or set them in the Vercel dashboard):',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 66' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.67',
    text: 'Your application is live. Visit `https://my-business.vercel.app/admin` to access the admin dashboard in production.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 67' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.68',
    text: '**Important:** After deploying, update your Stripe webhook endpoint in the [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks) to point to `https://my-business.vercel.app/api/webhooks/stripe`. Also update `REVEALUI_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_SERVER_URL` to your production URL.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 68' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.69',
    text: 'Stop the clock. With accounts pre-provisioned (NeonDB, Stripe, Vercel) and copy-paste commands, the walkthrough fits in about 30 minutes start to deployed. From here you have a business application with:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 69' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.70',
    text: '**A admin with typed collections and access control**  -  define your data model in TypeScript, get a full admin UI and REST API automatically',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 70' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.71',
    text: '**User authentication with session-based auth**  -  secure by default with httpOnly cookies, brute force protection, and rate limiting',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 71' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.72',
    text: '**A REST API with OpenAPI documentation**  -  every collection gets CRUD endpoints with interactive Swagger docs at `/docs`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 72' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.73',
    text: '**Stripe billing with subscription management**  -  checkout sessions, webhook handling, and automatic license generation',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 73' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.74',
    text: '**License enforcement with feature gating**  -  tier-based access control (`free`, `pro`, `max`, `enterprise`) enforced at the API level',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 74' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.75',
    text: '**An admin dashboard**  -  manage content, users, licenses, and settings from a single interface',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 75' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.76',
    text: '**Deployed to production on Vercel**  -  global edge network, automatic SSL, zero-config scaling',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 76' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.77',
    text: 'This is what "build your business, not your boilerplate" means. Every piece of infrastructure that software companies need - People, Content, Offers, Payments, and Agents are pre-wired and ready.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 77' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.78',
    text: 'You have the foundation. Here is where to go from here:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 78' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.79',
    text: 'Upgrade to [RevealUI Pro](https://revealui.com/pricing) for AI agents with CRDT memory, LLM orchestration, and task history:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 79' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.80',
    text: 'RevealUI ships with 13 first-party MCP (Model Context Protocol) servers (including Stripe, Neon, Vercel, Playwright, Code Validator, and Next.js DevTools). See the full list in [`packages/mcp/src/servers/`](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp/src/servers). Let your AI agents interact directly with your business infrastructure.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 80' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.81',
    text: 'The pattern scales. Add products, orders, tickets, knowledge bases - each collection is a single TypeScript file with automatic API generation and access control.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 81' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.82',
    text: '[Documentation](https://docs.revealui.com)  -  full reference for every package and API',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 82' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.83',
    text: '[GitHub](https://github.com/RevealUIStudio/revealui)  -  star the repo, report issues, contribute',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 83' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.84',
    text: '[Community Forum](https://github.com/RevealUIStudio/revealui/discussions)  -  ask questions, share what you are building',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 84' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/getting-started',
    exportPath: 'body.85',
    text: '*RevealUI is the open runtime for businesses that run their own AI. People, Content, Offers, Payments, and Agents, pre-wired, open source, and ready to deploy. Get started at [revealui.com](https://revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/08-getting-started.md', note: 'body source paragraph 85' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.0',
    text: '*The web was built for browsers. The next web is being built for agents.*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.1',
    text: '**Status note (updated 2026-05-18):** This post discusses the **agent-first future** RevealUI is building toward. Specifically: x402 micropayments (USDC on Base) (coming soon, [#93](https://github.com/RevealUIStudio/revealui/issues/93)) and the per-call MCP server marketplace (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)) are **designed but not transactable today**. The x402 endpoints are code-complete behind `X402_ENABLED=false`; the marketplace ships its first-party catalog (13 MCP servers) but third-party publishing, payment proxying, and per-call billing are unbuilt. The Agent Card endpoint (`/.well-known/agent.json`) ships today; `payment-methods.json` ships with an `X402_ENABLED=false` empty-payments shape. See [What Works Today](../WHAT_WORKS_TODAY.md) for current shipping status of every system mentioned below.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.2',
    text: 'I have been building RevealUI for the past year as the open runtime for businesses that run their own AI -- the kind of thing where you get People, Content, Offers, Payments, and Agents pre-wired, open source, and ready to deploy. The whole point is that you should not have to re-implement billing or auth or an admin every time you start a new software business.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.3',
    text: 'But somewhere around the third month of building, I realized something that changed the architecture fundamentally: **the next wave of customers for software platforms are not human.**',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.4',
    text: 'They are AI agents. And agents do not browse websites.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.5',
    text: 'The shift from human-first to agent-first',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.6',
    text: 'When you build a SaaS product today, the acquisition funnel looks something like this: a developer searches Google, lands on your marketing page, reads the hero section, clicks "Get Started," creates an account, enters a credit card, and starts building. Every pixel on your landing page is optimized for that flow.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.7',
    text: 'Now consider what happens when a developer asks Claude, "What platform has billing built in and supports MCP?" The agent does not open a browser. It does not read your hero banner. It does not care about your gradient backgrounds or testimonial carousel. It searches structured data sources -- package registries, OpenAPI specs, Agent Cards, tool definitions -- and evaluates them programmatically.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.8',
    text: 'This is not a hypothetical future. Industry coverage and analyst forecasts in 2025–2026 have consistently put autonomous AI agents on the path to becoming primary consumers of web APIs and structured data, with adoption projections in the tens of percent of enterprise applications and the agent-economy total addressable market growing at high double-digit rates year-over-year. (Specific figures cycle quickly; treat the directional signal as the durable claim, not the exact percentages.)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.9',
    text: 'The traditional marketing funnel is not going away. But it is being supplemented by a parallel funnel:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.10',
    text: '| Human funnel | Agent funnel | |---|---| | Landing page | `/.well-known/agent.json` | | Feature comparison table | OpenAPI spec (`/openapi.json`) | | Pricing page | `/.well-known/payment-methods.json` | | App store listing | MCP registry (`/.well-known/marketplace.json`) | | Sign up + credit card | x402 micropayment (USDC on Base) | | Onboarding wizard | Tool invocation via JSON-RPC |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.11',
    text: 'Both funnels serve the same product. The difference is the interface.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.12',
    text: "RevealUI's agent storefront",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.13',
    text: 'Every RevealUI instance ships with four machine-readable discovery endpoints. These are not optional add-ons or plugins. They are part of the platform, deployed automatically when you deploy your API.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.14',
    text: '**`/.well-known/agent.json`** -- The A2A Agent Card. This is the equivalent of a business card for your AI agent. It tells other agents what your instance can do, what protocols it supports, and where to send tasks.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.15',
    text: "**`/openapi.json`** -- The machine-readable API specification, auto-generated from route definitions. Every endpoint in RevealUI's Hono API is defined with Zod schemas that produce OpenAPI 3.0 output. When an agent evaluates whether RevealUI can handle a task, it reads this spec -- not your docs site.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.16',
    text: '**`/.well-known/marketplace.json`** -- The MCP marketplace discovery document. Lists every published MCP server, its category, pricing, and invocation URL:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.17',
    text: '**`/.well-known/payment-methods.json`** -- The x402 payment terms. Tells agents exactly how to pay for API calls: which network, which token, which address, what price.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.18',
    text: 'These four endpoints *are* your marketing site for agent customers. When an agent evaluates RevealUI, it does not read hero banners. It reads structured data, compares it against its task requirements, and makes a programmatic decision.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.19',
    text: 'The protocols that make this possible',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.20',
    text: 'Four protocols converge to create the agent-first web. Each solves a different piece of the puzzle, and RevealUI implements all four.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.21',
    text: '| Protocol | Created by | Governed by | Purpose | RevealUI implementation | |---|---|---|---|---| | **A2A** (Agent-to-Agent) | Google | Linux Foundation (Agentic AI Foundation) | Agents discover and delegate work to other agents | Full A2A 1.0: Agent Cards, JSON-RPC task lifecycle (`tasks/send`, `tasks/get`, `tasks/cancel`), SSE streaming | | **MCP** (Model Context Protocol) | Anthropic | Open standard | Agents use tools exposed by MCP servers | 13 first-party MCP servers: Stripe, Neon, Vercel, Code Validator, Playwright, Next.js DevTools, plus the RevealUI-internal Content / Email / Memory / Stripe / Docs servers, the contracts introspection server, and the adapter base class | | **x402** (HTTP 402 Payment Required) | Coinbase | Open standard | Internet-native micropayments for machine-to-machine commerce | Per-call USDC payments on Base, Coinbase facilitator verification, marketplace payment proxy | | **OpenAPI** | OpenAPI Initiative | Linux Foundation | Machine-readable API descriptions | Auto-generated from Hono route definitions with Zod schemas |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.22',
    text: 'A2A: How agents find and talk to each other',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.23',
    text: "Google's Agent-to-Agent protocol, now stewarded by the Linux Foundation's Agentic AI Foundation, defines how agents discover each other and delegate tasks. The core primitive is the **Agent Card** -- a JSON document at a well-known URL that describes what an agent can do.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.24',
    text: 'RevealUI implements the full A2A 1.0 task lifecycle. An external agent can:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.25',
    text: '**Discover** the platform agent via `GET /.well-known/agent.json`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.26',
    text: '**Send a task** via `POST /a2a` with a JSON-RPC `tasks/send` request',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.27',
    text: '**Subscribe to updates** via SSE at `/a2a/stream/:taskId`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.28',
    text: '**Check status** via `tasks/get`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.29',
    text: '**Cancel** a running task via `tasks/cancel`',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.30',
    text: 'Task execution is gated behind the `ai` feature flag -- you need a Pro or Enterprise license for agents to actually run tasks. But discovery is always public. Any agent on the internet can find your RevealUI instance and understand what it offers.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.31',
    text: "Agents use the host's configured inference path. The `createLLMClientFromEnv()` factory auto-detects the available backend (Ubuntu Inference Snaps or Ollama) - no API keys required, no vendor lock-in.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 31' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.32',
    text: 'The Model Context Protocol (MCP) defines how agents invoke tools. Where A2A is about agent-to-agent communication, MCP is about agent-to-tool communication. An MCP server exposes a set of tools -- functions that an agent can call with structured inputs and get structured outputs.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 32' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.33',
    text: 'RevealUI ships with 13 first-party MCP servers (full list in [`packages/mcp/src/servers/`](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp/src/servers)). The seven that cover the core infrastructure stack:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 33' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.34',
    text: '**Stripe** -- Create checkout sessions, manage subscriptions, query payment history',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 34' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.35',
    text: '**Supabase** -- Vector storage, real-time auth, embedding operations',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 35' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.36',
    text: '**Neon** -- Database management, connection pooling, branch operations',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 36' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.37',
    text: '**Vercel** -- Deployment management, environment variables, domain configuration',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 37' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.38',
    text: '**Code Validator** -- Static analysis, security scanning, TypeScript type checking',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 38' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.39',
    text: '**Playwright** -- Browser automation, E2E testing, screenshot capture',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 39' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.40',
    text: '**Next.js DevTools** -- Route inspection, build analysis, performance profiling',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 40' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.41',
    text: 'These servers are open source (MIT licensed). Anyone can run them, fork them, or publish improved versions to the marketplace.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 41' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.42',
    text: 'This is the piece most people have not seen yet, and it is the one that makes the economics work.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 42' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.43',
    text: "HTTP status code 402 -- Payment Required -- has been reserved since 1997 but never had a standard implementation. Coinbase's x402 protocol fills that gap. When an agent makes a request and the server requires payment, it returns HTTP 402 with an `X-PAYMENT-REQUIRED` header containing the price and payment details. The agent pays in USDC on Base (an Ethereum L2), then retries with a signed payment proof in the `X-PAYMENT-PAYLOAD` header.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 43' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.44',
    text: 'Here is what the flow looks like in practice when an agent invokes a marketplace MCP server:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 44' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.45',
    text: "The payment is verified by Coinbase's public facilitator at `x402.org/facilitator`. No API key required for verification. The entire flow is stateless from the agent's perspective -- pay, prove, get access.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 45' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.46',
    text: "RevealUI's marketplace will use x402 as the payment rail for all per-call MCP server invocations (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)). The default price will be $0.001 USDC per call, but each server sets its own price.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 46' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.47',
    text: 'OpenAPI: The foundation layer',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 47' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.48',
    text: "Every route in RevealUI's API is defined using `@revealui/openapi` -- a thin wrapper around Hono's OpenAPI integration with Zod schema validation. This means the `/openapi.json` endpoint is always accurate, always complete, and always in sync with the actual API.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 48' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.49',
    text: 'Agents that support OpenAPI (which is most of them) can consume your entire API without any custom integration. The spec includes request schemas, response schemas, authentication requirements, and rate limit documentation.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 49' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.50',
    text: 'The marketplace as an agent ecosystem',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 50' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.51',
    text: 'The MCP marketplace is where the agent-first architecture becomes an economy.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 51' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.52',
    text: "**For developers:** You build an MCP server that does something useful -- code analysis, data transformation, document processing, whatever. You publish it to RevealUI's marketplace with a per-call price. The marketplace handles discovery, payment, and proxying.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 52' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.53',
    text: '**For agents:** Other agents discover your server via the marketplace registry or A2A protocol, evaluate its capabilities from the structured metadata, and invoke it with x402 payment.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 53' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.54',
    text: "**The economics:** Developers earn 80% of each call's revenue. RevealUI takes 20%. Payouts happen via Stripe Connect -- developers onboard once, and transfers are batched automatically. At $0.001 per call, a server handling 100,000 calls per month generates $80 for the developer and $20 for the platform. At $0.005 per call, those numbers are $400 and $100.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 54' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.55',
    text: "This will be the first combined MCP + A2A registry (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)). Smithery, mcpt, OpenTools, and Glama.ai list MCP servers. The a2a-registry.org lists A2A agents. RevealUI's marketplace is the first to combine both -- agents that are discoverable via A2A *and* tools that are invocable via MCP, with a payment layer that lets the economics work without manual billing integration. Registration on external registries (a2a-registry.org, Smithery, mcpt, OpenTools, Glama.ai) is planned for hard launch.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 55' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.56',
    text: 'The marketplace is secured against common attack vectors. Developer-supplied MCP server URLs are validated against an SSRF guard that blocks loopback, link-local, and private RFC-1918 ranges. Proxied requests have a 30-second timeout. Rate limiting prevents probe abuse (30 invocations per minute per caller). And the x402 payment itself acts as an economic rate limiter -- every call costs real money, which naturally deters spam.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 56' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.57',
    text: 'What this means for developers using RevealUI',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 57' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.58',
    text: 'If you deploy a RevealUI instance today, you get agent-native infrastructure without any extra configuration. Here is what that means in practice:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 58' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.59',
    text: '**Your API is already agent-readable.** The OpenAPI spec at `/openapi.json` is auto-generated from your route definitions. Any agent that supports OpenAPI can consume your API today. You do not need to write a separate "agent integration."',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 59' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.60',
    text: "**Your instance is already discoverable.** The Agent Card at `/.well-known/agent.json` advertises your instance's capabilities to the A2A network. Other agents can find you and evaluate whether you can handle their tasks.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 60' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.61',
    text: '**Feature gating works for both audiences.** When a human user hits a Pro feature, they see the billing page and can upgrade. When an agent hits a Pro feature without a license, it gets a structured JSON error with the pricing URL. When the x402 flag is set (`X402_ENABLED`, default off; planned, [#93](https://github.com/RevealUIStudio/revealui/issues/93)), agents can pay per-call instead of subscribing -- the same feature, two access patterns.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 61' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.62',
    text: '**You will be able to earn money from MCP servers while you sleep (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)).** Publish an MCP server to the marketplace, set a per-call price, onboard with Stripe Connect, and agent calls generate passive revenue. The marketplace handles discovery, payment verification, proxying, transaction recording, and developer payouts.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 62' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.63',
    text: '**The same code serves both audiences.** This is the key architectural insight. You do not build a "human API" and an "agent API." You build one API with Zod schemas and OpenAPI definitions. Humans consume it via the admin dashboard. Agents consume it via the OpenAPI spec and A2A protocol. The code is identical.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 63' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.64',
    text: 'How to make your RevealUI instance agent-discoverable',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 64' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.65',
    text: 'Here is the concrete, four-step process.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 65' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.66',
    text: 'That is it for the basics. The Agent Card (`/.well-known/agent.json`) and OpenAPI spec (`/openapi.json`) are generated automatically from your route definitions. The marketplace discovery document (`/.well-known/marketplace.json`) is always available with your published servers. The payment methods document (`/.well-known/payment-methods.json`) activates when you set `X402_ENABLED=true` and configure a receiving wallet.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 66' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.67',
    text: '**Step 2: Verify your Agent Card.**',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 67' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.68',
    text: "The response describes your instance's capabilities, supported protocols, and available skills. This is what other agents read when they evaluate your platform. Make sure the skills list matches what your instance actually offers.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 68' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.69',
    text: '**Step 3: Publish MCP servers to the marketplace.**',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 69' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.70',
    text: 'If you have built custom MCP servers, publish them to the marketplace for other agents to discover and use. Each server needs a name, description, category, HTTPS URL, and per-call price.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 70' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.71',
    text: 'After publishing, verify your server appears in the marketplace registry:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 71' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.72',
    text: '**Step 4: Add `AGENTS.md` to your repository.**',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 72' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.73',
    text: 'The Agentic AI Foundation (the same organization governing A2A) has standardized the `AGENTS.md` file as the equivalent of `README.md` for AI coding agents. It tells agents like Claude Code, Cursor, and Copilot how to work with your codebase -- what the project does, how to build and test it, what conventions to follow.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 73' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.74',
    text: 'RevealUI already has a `CLAUDE.md` that serves this purpose. An `AGENTS.md` in your repository root makes the same information available to all coding agents, not just Claude.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 74' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.75',
    text: 'We are in the early innings of the agent-first internet. Most platforms today are built exclusively for human users. The ones that will win the next decade are the ones building for both audiences simultaneously.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 75' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.76',
    text: 'This does not require exotic technology. It requires structured data at well-known URLs. It requires machine-readable API specifications. It requires payment flows that do not assume a human is clicking buttons. And it requires the discipline to treat agents as first-class customers, not afterthoughts.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 76' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.77',
    text: 'RevealUI is built on this thesis. Every endpoint is defined with schemas that produce both human-readable documentation and machine-readable specifications. Every feature is gated with logic that works for both session-authenticated humans and x402-paying agents. Every MCP server is discoverable via both the marketplace registry and the A2A protocol.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 77' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.78',
    text: 'The user interface for the future has yet to reveal itself. But we know one thing: it will not be a browser for every user. Some users will be agents. And the platforms that serve them well will be the ones that thought about it from the start.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 78' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.79',
    text: '*RevealUI is the open runtime for businesses that run their own AI. People, Content, Offers, Payments, and Agents, pre-wired and ready to deploy. Learn more at [revealui.com](https://revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 79' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/agent-first-future',
    exportPath: 'body.80',
    text: '*Follow the project on [GitHub](https://github.com/RevealUIStudio/revealui).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/07-agent-first-future.md', note: 'body source paragraph 80' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.0',
    text: "RevealUI is open source today; the commercial side is pre-launch. Before we talk about features or roadmaps, I want to be completely transparent about how we plan to make money, what's free, what's paid, and why.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.1',
    text: "This is a solo-founder project. I don't have a VC board to answer to or a growth team optimizing conversion funnels. I have a business model I believe in, and I'd rather explain it plainly than have you discover the trade-offs later.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.2',
    text: '**Status note (updated 2026-07-29):** Two revenue surfaces described later in this post (the **MCP Marketplace** (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526); third-party publishing + 80/20 revenue share) and **x402 agent payments** (coming soon, [#93](https://github.com/RevealUIStudio/revealui/issues/93))) remain **planned, not fully shipped**. The first-party MCP catalog (servers under `packages/mcp/src/servers/`) does ship today; third-party publishing, marketplace discovery UI, and developer payouts are still incomplete. x402 is designed and code-complete behind `X402_ENABLED=false`. **Stripe is live** in production (live mode on since 2026-06-26). See [What Works Today](../WHAT_WORKS_TODAY.md) for the current shipping status of every commercial surface.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.3',
    text: 'RevealUI\'s core is MIT licensed. Not AGPL, not SSPL, not BSL, not "source-available with a Commons Clause." MIT.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.4',
    text: "I chose MIT because it's the simplest license that exists. No restrictions, no gotchas, no \"well actually, you can't host it as a service.\" You can fork it, sell it, white-label it, build a competing product on top of it, and never pay me a cent. That's the deal.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.5',
    text: 'This wasn\'t a naive decision. I\'m aware of the arguments for more restrictive licenses. AGPL forces service providers to release their modifications. BSL gives you a time-delayed open source release. SSPL tries to close the "cloud loophole." Each of these exists because companies got burned by cloud providers reselling their work without contributing back.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.6',
    text: "I understand that risk. I accept it. Here's why.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.7',
    text: "RevealUI is an open runtime for businesses that run their own AI. The open-core business primitives, People, Content, Offers, and Payments, are MIT licensed and will stay MIT forever. These are table stakes. Every business needs auth, a content system, a product catalog, and payment processing. Making these proprietary would limit adoption without meaningfully protecting revenue. The value isn't in the code; it's in the integration, the maintenance, and the roadmap.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.8',
    text: "The MCP framework is the one piece worth naming carefully: `@revealui/mcp` (the hypervisor, the 13 first-party servers, and the adapter base class) is one of the five Pro packages, Fair Source under FSL-1.1-MIT, not MIT. It's source-visible and converts to MIT two years after each release, but MCP integration is a paid capability today. I'd rather state that plainly than imply the AI tooling is free when it isn't.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.9',
    text: "What MIT means practically: you can take RevealUI, strip the branding, deploy it on your own infrastructure, and run your entire business on it without ever creating an account with us. You don't owe us attribution, revenue share, or even a thank-you. The code is yours.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/06-open-source-and-pro.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.10',
    text: "If everything important is MIT, what's left to sell?",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.11',
    text: '**AI agents** -- task execution, multi-step workflows, autonomous operations',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.12',
    text: '**CRDT memory** -- working memory, episodic memory, and vector storage that persists across agent sessions',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.13',
    text: '**LLM orchestration** -- open-model inference via Ubuntu Inference Snaps and Ollama',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.14',
    text: '**Editor integrations** -- config sync for Zed and VS Code',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.15',
    text: '**Harness coordination** -- workboard-based agent orchestration, JSON-RPC communication, daemon management',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.16',
    text: '**MCP framework** -- the hypervisor, 13 first-party servers, and the adapter base class that connect agents to tools',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.17',
    text: 'These features are commercially licensed. The source code is available (you can read the compiled output on npm), but the license restricts redistribution and commercial use without a key.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.18',
    text: 'Why AI specifically? Three reasons.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.19',
    text: '**It\'s the highest-value part of the stack.** AI agents that can manage your content, process payments, handle support tickets, and coordinate across services are genuinely transformative. This is where RevealUI stops being "another framework" and starts being an open runtime for businesses that run their own AI.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.20',
    text: "**It's the most expensive to maintain.** Open-model inference evolves rapidly. Model formats change, quantization techniques improve, context windows expand, and new inference backends emerge. Maintaining reliable integrations across inference paths -- with memory systems, CRDT synchronization, and multi-agent coordination -- is a full-time job. Pro revenue funds this work directly.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.21',
    text: '**It\'s the clearest value boundary.** The line between "business primitives everyone needs" and "AI capabilities power users want" is clean. There\'s no ambiguity about what you\'re paying for.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.22',
    text: "Pro packages are published to npm as compiled distributions. You can install them, inspect the output, and verify what they do. We don't obfuscate the code or phone home. The license key unlocks the features; it doesn't enable surveillance.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.23',
    text: '| | Free (OSS) | Pro | Max | Enterprise | |---|---|---|---|---| | **Price** | Free forever | $49/month | $299/month | $1,499/month, sales-led | | **Sites** | 1 | 5 | 15 | Unlimited | | **Users/editors** | 3 | 25 | 100 | Unlimited | | **Agent tasks/mo** | 1,000 | 10,000 | 50,000 | Unlimited | | **API rate limit** | 200 req/min | 300 req/min | 600 req/min | 1,000 req/min | | **Auth** | Session + OAuth (GitHub / Google / Vercel) | Same | Same | Session + OAuth + Enterprise SSO (OIDC/SAML SP-initiated, [#449](https://github.com/RevealUIStudio/revealui/issues/449)) | | **admin collections** | Unlimited | Unlimited | Unlimited | Unlimited | | **Real-time sync** | Basic | Full | Full | Full | | **Local AI inference (Snaps / Ollama)** | Yes | Yes | Yes | Yes | | **AI agents (orchestration)** | -- | Yes | Yes | Yes | | **AI memory** | -- | -- | Full (working + episodic + vector) | Full | | **Advanced inference config** | -- | -- | Yes | Yes | | **Stripe payments** | -- | Built-in | Built-in | Built-in | | **Monitoring dashboard** | -- | Yes | Yes | Yes | | **Custom domains** | -- | Yes | Yes | Yes | | **Multi-tenant** | -- | -- | -- | Yes | | **White-label** | -- | -- | -- | Yes (planned, [#515](https://github.com/RevealUIStudio/revealui/issues/515)) | | **Support** | Community | Email (48h) | Email (24h) | Slack (not yet available) | | **Source code** | Full | Full | Full | Full |',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.24',
    text: 'A few things worth noting about this table.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.25',
    text: '**The free tier is genuinely useful.** Unlimited admin collections, session-based auth, basic real-time sync, local AI inference (Inference Snaps / Ollama), and full source code access. You can build and run a real product on the free tier. I don\'t want "free" to mean "demo."',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.26',
    text: "**Open-core business primitives work on free.** People, Content, Offers, and Payments, the MIT core, are fully functional at every tier. Free doesn't cripple the business stack to pressure upgrades. The tier boundaries are about scale (more sites, more users, higher rate limits) and AI capabilities.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.27',
    text: "**Pro and Max include a 7-day trial.** You try it, you decide, you pay if it's worth it. If the product can't convince you in seven days, a payment wall on day one wasn't going to help.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 27',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.28',
    text: 'Not everyone wants a subscription. We offer three ways to pay:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 28',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.29',
    text: '**Track A: Subscriptions** -- Monthly plans as shown above. Cancel anytime.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 29',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.30',
    text: '**Track B: Agent credits** -- Buy task bundles that never expire. Top up any plan when you need burst capacity. Three tiers: Starter (10,000 tasks), Standard (60,000 tasks, 17% cheaper per task), and Scale (350,000 tasks, 29% cheaper per task).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 30',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.31',
    text: '**Track C: Perpetual licenses** -- Pay once, use forever. Pro Perpetual, Agency Perpetual (up to 10 client deployments), and Enterprise Perpetual (unlimited self-hosted deployments). Each includes one year of priority support and all updates released during that year. After the year, the software keeps working -- you just stop getting new releases unless you renew support.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 31',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.32',
    text: 'Perpetual licenses exist because some teams have procurement processes that can\'t handle subscriptions, and because "pay once, own it forever" is a model I personally respect.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 32',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.33',
    text: '**Early adopters get a discount.** Our first customers are taking a bet on a new product from a solo founder. That deserves recognition, not full price. Coupon codes will be available at launch for meaningful savings on the first year.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 33',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.34',
    text: 'The Economics of Open Source',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 34',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.35',
    text: "Let me be direct about the risk I'm taking.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 35',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.36',
    text: 'MIT means anyone can use everything without paying. A cloud provider could take RevealUI, host it as a managed service, charge money for it, and owe me nothing. A consultancy could fork it, rebrand it, and sell it as their own product. A competitor could copy the architecture and undercut me on price.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 36',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.37',
    text: "This is intentional. I'm not being naive about it -- I'm making a bet.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 37',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.38',
    text: 'The bet is this: **most companies don\'t want to self-host and maintain production infrastructure.** Self-hosting is free, but "free" doesn\'t include the engineer-hours spent on database migrations, security patches, uptime monitoring, backup verification, and the hundred other operational tasks that come with running software in production.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 38',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.39',
    text: "What companies actually want is someone who maintains the software full-time, ships security patches promptly, provides a roadmap they can plan around, and answers the phone when something breaks. That's worth paying for, and that's what Pro provides.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 39',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.40',
    text: 'The model works like this:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 40',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.41',
    text: '**Free primitives build adoption.** MIT-licensed business tools attract developers who need auth, content management, and payment processing. No friction, no signup, no sales call.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 41',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.42',
    text: '**Pro AI features convert power users.** Teams that outgrow the free tier -- more sites, more users, AI automation -- upgrade to Pro. The conversion happens because the product is genuinely more capable, not because we crippled the free version.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 42',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.43',
    text: '**Marketplace commissions will create ecosystem revenue (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)).** Developers will publish MCP servers to our marketplace, set their own pricing, and earn 80% of revenue. We take 20% for hosting, discovery, and billing infrastructure. More developers building servers means more capability for agent users, which means more demand for agent tasks.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 43',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.44',
    text: "I'm not going to share revenue projections here. That's not the point. The point is transparency: here's exactly what's free, what's paid, and why. You can decide whether the trade-off makes sense for your team.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 44',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.45',
    text: "RevealUI isn't just a framework you install. It's an open runtime for businesses that run their own AI, with an ecosystem strategy.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 45',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.46',
    text: '**MCP Marketplace (coming soon, [#526](https://github.com/RevealUIStudio/revealui/issues/526)).** Developers will be able to publish MCP servers -- tools that AI agents use to interact with external services -- with per-call pricing via the x402 payment protocol. Server authors earn 80% of revenue. The publish/list/invoke/onboard endpoints are wired today; third-party developer payouts are not fully shipped yet (Stripe live mode is already on for first-party billing). We handle discovery, billing, and the agent routing infrastructure. The goal is a self-sustaining marketplace where developers build specialized integrations and get paid for their work.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 46',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.47',
    text: '**"Built with RevealUI" badge.** Completely opt-in. If you display the badge, you get 500 bonus agent tasks per month. If you don\'t want it, don\'t use it. We will never require attribution. MIT means MIT.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 47',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.48',
    text: "**Template marketplace.** Starter projects on Vercel that showcase RevealUI for specific use cases -- SaaS boilerplates, e-commerce setups, documentation sites, internal tools. These lower the barrier to getting started and demonstrate what's possible.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 48',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.49',
    text: "**Community discussions.** Free support for everyone through community forums. Pro and above get priority support with faster response times. The community is where we build trust, gather feedback, and help people succeed -- regardless of what tier they're on.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 49',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.50',
    text: '**The flywheel.** More developers using RevealUI means more MCP servers published to the marketplace. More MCP servers means agents can do more things. More capable agents means more demand for agent tasks. More demand means more developers building servers. Each layer reinforces the others.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 50',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.51',
    text: "This only works if the free tier is good enough that people actually adopt it. That's why the MIT core has to be genuinely useful, not a teaser.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 51',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.52',
    text: "Commitments matter more when they're specific. Here's what we will not do:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 52',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.53',
    text: "**We won't paywall security features.** Authentication, rate limiting, encryption, brute force protection, CORS, CSP headers, RBAC -- these are part of the MIT core and they stay there. Security is not a premium feature. Every RevealUI deployment, free or paid, gets the same security stack.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 53',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.54',
    text: '**We won\'t add tracking or telemetry without consent.** RevealUI does not phone home. There are no analytics beacons, no usage tracking, no "anonymous" telemetry that ships data to our servers. If we ever add optional telemetry (for crash reporting, for example), it will be off by default and require explicit opt-in.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 54',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.55',
    text: "**We won't change the MIT license on existing code.** Code that's MIT today stays MIT forever. We might add new proprietary features in the future, but we will never relicense existing MIT code to something more restrictive. You can rely on that.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 55',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.56',
    text: "**We won't force upgrades.** Your version works forever. License keys don't expire (perpetual) or deactivate on downgrade (subscription -- you just lose access to Pro features, the software keeps running on the free tier). We don't have a kill switch and we won't build one.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 56',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.57',
    text: "**We won't sell user data.** We don't collect it. RevealUI runs on your infrastructure, connected to your database. We don't have access to your users' data, your content, or your transactions. The only data we store is your license key and account email.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 57',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.58',
    text: "Here's the part most launch posts skip.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 58',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.59',
    text: "I don't know if this model will work. MIT open source with a commercial AI tier is a bet that enough teams will find enough value in the Pro features to sustain a solo founder's business. Maybe they will. Maybe they won't. Maybe a cloud provider will host it for free and I'll need to find a different angle.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 59',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.60',
    text: "What I do know is that the alternative -- restrictive licensing, crippled free tiers, dark patterns in the upgrade flow -- might generate more short-term revenue but would make me build a product I don't want to use.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 60',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.61',
    text: "RevealUI is the business stack I wanted when I started building software companies. People, Content, Offers, Payments, and Agents, pre-wired, open source, and ready to deploy. If it's useful to you at $0, that's a win. If it's useful enough to pay for, even better.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 61',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.62',
    text: "The code is on [GitHub](https://github.com/RevealUIStudio/revealui). The license is MIT. The Pro features include a 7-day free trial. Everything I've described in this post is verifiable.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 62',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/open-source-and-pro',
    exportPath: 'body.63',
    text: '*RevealUI is the open runtime for businesses that run their own AI. Learn more at [revealui.com](https://revealui.com) or read the [docs](https://docs.revealui.com).*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/06-open-source-and-pro.md',
        note: 'body source paragraph 63',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.0',
    text: '**Status note (updated 2026-05-26):** One forward-looking system mentioned in this post is not transactable in production today: **x402 agent-to-agent payments** (designed and code-complete behind `X402_ENABLED=false`). Everything else described (auth, content, Stripe billing, MCP wiring, agent primitives) runs today. See [What Works Today](../WHAT_WORKS_TODAY.md) for the current per-feature shipping status.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.1',
    text: 'Every software company ships the same five things: a way to manage people, a way to manage content, a way to sell offers (catalogs, tiers, licenses), a way to collect payments, and increasingly, agents that run AI. These are not features. They are primitives. And yet every engineering team builds them from scratch, bolting together auth libraries, content engines, payment wrappers, and AI SDKs, spending months on plumbing before writing a single line of differentiated code.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.2',
    text: 'RevealUI is the open runtime for businesses that run their own AI. Its thesis is simple: these five primitives should be pre-wired, open source, and ready to deploy. You bring your business logic. We bring the infrastructure.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.3',
    text: 'This post is a deep technical walkthrough of all five. Not marketing copy. Real code, real architecture decisions, real trade-offs.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.4',
    text: "Authentication is the foundation. Get it wrong and nothing else matters. RevealUI's auth system is session-based, not JWT-based, and that is a deliberate choice.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.5',
    text: 'JWTs are popular because they are stateless. The server does not need to look up a session on every request. But that statelessness comes at a cost: you cannot revoke a JWT before it expires. If a user changes their password, gets compromised, or you need to force a logout, you are stuck waiting for the token to expire. You can work around this with a token blocklist, but now you have a stateful system with the complexity of JWTs and none of the benefits.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.6',
    text: 'RevealUI uses database-backed sessions. Each session is a row in PostgreSQL. Validation is a single indexed query. Session revocation is instant: delete the row, the user is logged out. The session token is a 32-byte cryptographically random value, hashed with SHA-256 before storage. The raw token lives only in an `httpOnly`, `secure`, `sameSite=lax` cookie.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.7',
    text: 'Sessions are also bound to context. When a request comes in, RevealUI validates the session token and optionally checks that the user-agent matches the one recorded at login. If the user-agent changes, the session is invalidated and the row is deleted. IP changes are logged as warnings by default and can be promoted to hard enforcement for high-security deployments.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.8',
    text: 'Passwords are hashed with bcrypt at 12 rounds. Not 10, not 8. Twelve rounds puts the hash computation at roughly 250ms on modern hardware, making brute force attacks on leaked hashes impractical without significant GPU resources.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.9',
    text: 'Every login attempt flows through two layers of protection. First, IP-based rate limiting: 5 attempts per 15-minute window with a 30-minute block after the threshold. Second, per-email brute force tracking: 5 failed attempts trigger a 30-minute account lockout. Both use atomic storage operations to prevent race conditions under concurrent requests.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.10',
    text: 'The sign-in flow always returns the same error message regardless of whether the email exists or the password is wrong. This prevents user enumeration attacks.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.11',
    text: 'OAuth without auto-linking',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.12',
    text: 'RevealUI supports OAuth with GitHub, Google, and Vercel. The critical design decision here is that OAuth identities are **never** auto-linked to existing accounts by email.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.13',
    text: 'Why? Auto-linking is an account takeover vector. If an attacker controls a Google account with your email address, they sign in via OAuth and instantly gain access to your existing account. RevealUI requires explicit linking: you must be authenticated with your existing session and then manually connect a provider.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.14',
    text: 'Users can link and unlink providers from their account settings. The system prevents unlinking the last authentication method, so you cannot accidentally lock yourself out.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.15',
    text: 'Multi-factor authentication',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.16',
    text: 'MFA is TOTP-based (RFC 6238) using timing-safe verification. When a user enables 2FA, RevealUI generates a TOTP secret and 8 bcrypt-hashed backup codes. The setup is two-step: generate the secret, then verify a code from the authenticator app before activating MFA. Backup codes are single-use and consumed on verification.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.17',
    text: 'For passwordless authentication, RevealUI implements WebAuthn passkeys using `@simplewebauthn/server`. Users can register up to 10 passkeys (biometrics, security keys, platform authenticators) and use them for primary authentication or as MFA verification for sensitive operations like disabling 2FA.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.18',
    text: 'Magic links provide a recovery path: HMAC-SHA256 hashed, single-use, 15-minute expiry.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.19',
    text: 'Access control is enforced through composable functions that check the request context:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.20',
    text: 'These functions return booleans or `WhereClause` objects, enabling row-level security. A `WhereClause` return lets you say "authenticated users can read, but only their own records." The access control system has 60 enforcement tests proving role isolation.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.21',
    text: 'How People connects to everything else',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.22',
    text: 'The user ID is the foreign key for everything. Content has an `authorId`. Offers have licenses keyed to `customerId`. Payments are tied via `stripeCustomerId`. Agent tasks are metered per `userId`. One identity, five primitives.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.23',
    text: 'Content is the second primitive. Not because it is more important than people, but because it is what people interact with first.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.24',
    text: 'Content in RevealUI is organized into collections. A collection is a typed schema with field definitions, access control rules, and lifecycle hooks. Posts, pages, media, sites -- each is a collection with its own REST API, automatically generated from the schema.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.25',
    text: 'Access control is enforced at the query level. Public requests only see published content. Non-admin users can only read and edit their own posts. Admin users see everything. The `overrideAccess` parameter is stripped from external requests at the proxy layer, so clients cannot bypass access rules.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.26',
    text: 'Rich text with XSS prevention',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.27',
    text: 'RevealUI uses Lexical for rich text editing. The editor state is stored as JSON, which means it can be rendered on the server without a browser. But rich text is also an XSS vector. Users can paste links with `javascript:` protocols, embed images with `data:text/html` URIs, or craft URLs that execute scripts.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.28',
    text: "RevealUI's server-side renderer sanitizes every URL before rendering:",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.29',
    text: "Posts support a status lifecycle: `draft`, `published`, `archived`, `scheduled`. The API enforces this at the route level. Creating a post defaults to draft. Publishing sets the `publishedAt` timestamp. Public API access always filters to `status = 'published'`.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.30',
    text: "Every route is defined using Hono's OpenAPI integration with Zod schemas. This means the API documentation is auto-generated from the actual route handlers -- not a separate spec file that drifts out of sync. The Swagger UI is available at `/docs` on the API server.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.31',
    text: 'How Content connects to everything else',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 31' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.32',
    text: 'Content is authored by People (the `authorId` foreign key). Premium content can be gated behind Offers (license tier checks). Content creation by AI agents feeds back through the Agents layer. Media uploads integrate with CDN delivery via the cache package.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 32' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.33',
    text: "Offers are what turns your software from a project into a business. RevealUI's offers primitive covers the catalog, license generation, and runtime feature gating.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 33' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.34',
    text: 'License keys: JWTs signed with Ed25519',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 34' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.35',
    text: 'License keys are JWT tokens signed with EdDSA (Ed25519). The payload contains the tier, customer ID, domain restrictions, site and user limits, and an optional perpetual flag. The private key signs; the public key verifies. This means license verification can happen offline, without calling home to a license server.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 35' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.36',
    text: 'Perpetual licenses omit the `exp` claim entirely. They are valid forever unless explicitly revoked in the database.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 36' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.37',
    text: 'The feature gate is a simple function: given a feature name, check if the current license tier meets the minimum requirement.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 37' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.38',
    text: "This is used as middleware in the API. AI routes check `requireFeature('ai')`. Multi-tenant routes check `requireFeature('multiTenant')`. The check is a tier comparison, not a boolean flag, so upgrading your license automatically unlocks all features at or below your tier.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 38' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.39',
    text: 'RevealUI supports three billing models simultaneously:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 39' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.40',
    text: '**Subscriptions** -- Monthly recurring charges via Stripe. Standard for SaaS.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 40' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.41',
    text: '**Agent credits** -- Usage-based metering for AI tasks. Pro tier gets 10,000 tasks/month, Max gets 50,000, Enterprise is unlimited. Reporting overage to Stripe Billing Meters is in development. During early access, usage is tracked but not billed.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 41' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.42',
    text: '**Perpetual licenses** -- One-time purchase, own forever, with an optional annual support renewal. The license JWT has no expiration, and the system tracks `supportExpiresAt` separately from the license validity.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 42' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.43',
    text: 'Verification checks both the JWT signature and the database. A structurally valid JWT can still be revoked in the database (chargeback, refund, manual revoke), so the verify endpoint checks both. The license cache TTL is 15 minutes, meaning a revoked license loses access within 15 minutes at most.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 43' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.44',
    text: 'How Offers connects to everything else',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 44' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.45',
    text: 'Offers are purchased by People. License keys are generated from the Payments webhook. Feature gates control access to Content (premium collections) and Agents (AI agent execution). The tier hierarchy flows through the entire stack.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 45' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.46',
    text: 'Payments are where business software earns its name. RevealUI integrates Stripe end-to-end: checkout, portal, subscription lifecycle, refunds, chargebacks, and usage reporting.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 46' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.47',
    text: 'Circuit breaker protection',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 47' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.48',
    text: 'Every Stripe API call goes through a circuit breaker. If Stripe returns 5 consecutive failures, the breaker opens and requests fail fast with a 503 for 30 seconds instead of piling up timeouts. After the cooldown, 2 successful requests close the breaker.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 48' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.49',
    text: 'DB-backed webhook idempotency',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 49' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.50',
    text: 'Stripe delivers webhooks at least once. In a multi-region deployment (Vercel edge), the same webhook can arrive at different instances simultaneously. RevealUI uses a `processed_webhook_events` table with an atomic INSERT to deduplicate:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 50' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.51',
    text: 'If the INSERT succeeds, this is the first time we have seen this event. If it hits a unique constraint violation, another instance already processed it. Any other database error returns 500 to Stripe, which will retry the webhook -- safe because our deduplication is idempotent.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 51' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.52',
    text: 'The webhook handler covers the full subscription lifecycle:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 52' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.53',
    text: '**`checkout.session.completed`** -- Creates the Stripe customer record, generates an Ed25519-signed license key, inserts it into the licenses table, and sends the activation email.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 53' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.54',
    text: '**`customer.subscription.updated`** -- Handles tier upgrades (new license key at the higher tier) and reactivation (payment recovered after a failed charge). On successful payment recovery, the license is re-activated and the user gets a recovery notification.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 54' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.55',
    text: '**`customer.subscription.deleted`** -- Revokes the license and downgrades to free.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 55' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.56',
    text: '**`invoice.payment_failed`** -- Sends a payment failure notification with a link to update billing details.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 56' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.57',
    text: '**`charge.dispute.closed`** -- On dispute loss, automatically revokes the license. The customer is notified and directed to re-purchase.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 57' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.58',
    text: '**`customer.subscription.trial_will_end`** -- Sends a 3-day trial ending reminder.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 58' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.59',
    text: 'x402 for agent-to-agent commerce',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 59' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.60',
    text: 'RevealUI implements the x402 payment protocol for machine-to-machine payments (designed and code-complete, behind the `X402_ENABLED=false` flag). See the status note above. Agents discover payment methods via `/.well-known/payment-methods.json` and pay per-task in USDC on Base. This enables an economy where AI agents can purchase compute, data, and services from other agents without human intervention.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 60' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.61',
    text: 'How Payments connects to everything else',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 61' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.62',
    text: 'Payments are initiated by People (checkout requires a session). Successful payments generate Offers (license keys). Payment status controls feature access across Content and Agents. Webhook events update the `users` table (`stripeCustomerId`) and the licenses table (Offers). Chargebacks revoke licenses instantly.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 62' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.63',
    text: 'The fifth primitive is Agents. Not a chatbot bolted onto a sidebar, but an agent orchestration system with memory, streaming, and inter-agent communication.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 63' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.64',
    text: 'AI agent execution streams results in real-time using Server-Sent Events. The client posts an instruction, and the server streams execution events as they happen:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 64' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.65',
    text: 'The `@revealui/ai` package is loaded dynamically. If the license is free, the import returns null and the route returns 403. No AI code is ever loaded into memory for free-tier deployments.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 65' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.66',
    text: 'RevealUI defaults to open-weight models (no API key, no cloud bill, no vendor lock-in). Cloud providers (Groq, HuggingFace, and OpenAI-compatible endpoints) are opt-in via environment variables. The inference path is auto-detected:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 66' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.67',
    text: '**Ubuntu Inference Snaps** (recommended)  -  Canonical snap runtime (US-origin allowlist: Nemotron-3-nano, Gemma 3/4, Nemotron Omni)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 67' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.68',
    text: '**Ollama** (fallback)  -  Any open source GGUF model (chat: `gemma4:e2b`, embeddings: `nomic-embed-text`)',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 68' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.69',
    text: 'The AI memory system uses four memory types, modeled on cognitive science:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 69' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.70',
    text: '**Episodic** -- Records of past interactions and their outcomes. "What happened the last time we ran this task?"',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 70' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.71',
    text: '**Working** -- Short-term context for the current task. Cleared between sessions.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 71' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.72',
    text: '**Semantic** -- Long-term knowledge stored as vector embeddings in Postgres (Neon pgvector). Enables retrieval-augmented generation without external vector databases.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 72' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.73',
    text: '**Procedural** -- Learned procedures and workflows. "How do we deploy to production?"',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 73' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.74',
    text: 'Memory operations use CRDTs (Conflict-free Replicated Data Types) for conflict resolution, so multiple agents can write to the same memory space without coordination locks.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 74' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.75',
    text: 'RevealUI ships **13 first-party MCP (Model Context Protocol) servers** in `@revealui/mcp` (Fair Source, FSL-1.1-MIT, source-visible, converts to MIT two years after release). The most commonly used:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 75' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.76',
    text: '| Server | Purpose | |--------|---------| | Stripe | Query customers, invoices, subscriptions from AI agents | | Supabase | Execute vector searches and auth operations | | Neon | Run SQL queries and manage database branches (remote endpoint at `mcp.neon.tech`) | | Vercel | Deploy, inspect deployments, manage environment variables | | Code Validator | Static analysis and lint checking within agent workflows | | Playwright | Browser automation for testing and scraping | | Next.js DevTools | Next.js 16+ runtime diagnostics and automation |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 76' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.77',
    text: 'In addition to those seven, RevealUI ships first-party servers (`revealui-content`, `revealui-email`, `revealui-memory`, `revealui-stripe`) and the shared `adapter` base class, all under [`packages/mcp/src/servers/`](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp/src/servers).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 77' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.78',
    text: 'These servers are tools that agents can invoke during task execution. An agent can query your Stripe dashboard, check your deployment status, and run your test suite without you writing integration code.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 78' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.79',
    text: 'RevealUI implements the Google A2A (Agent-to-Agent) specification over JSON-RPC 2.0. Agents expose discovery cards at `/.well-known/agent.json` and accept tasks via `POST /a2a`. The protocol supports:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 79' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.80',
    text: '**`tasks/send`** -- Submit a task and get a result',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 80' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.81',
    text: '**`tasks/sendSubscribe`** -- Submit a task and subscribe to streaming updates',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 81' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.82',
    text: '**`tasks/get`** -- Poll task status',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 82' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.83',
    text: '**`tasks/cancel`** -- Cancel a running task',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 83' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.84',
    text: "Task execution is gated behind the `ai` feature flag and metered against the user's quota. Every task execution is persisted to the `agentActions` table with timing data for billing and debugging.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 84' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.85',
    text: 'AI is not free. RevealUI tracks task usage per billing cycle:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 85' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.86',
    text: '| Tier | Monthly quota | |------|---------------| | Free | 1,000 tasks | | Pro | 10,000 tasks | | Max | 50,000 tasks | | Enterprise | Unlimited |',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 86' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.87',
    text: 'Usage beyond the quota is tracked in the `agent_task_usage` table. Reporting that overage to Stripe Billing Meters is in development. During early access, usage is recorded but not billed, so execution is never blocked on a meter.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 87' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.88',
    text: 'How Agents connects to everything else',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 88' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.89',
    text: 'AI agents authenticate through the People system (session cookies or API keys). Agents create and modify Content (posts, pages, media). Agent execution is metered through Offers (task quotas per tier). Overage billing feeds through Payments (Stripe Billing Meters). The A2A protocol enables agents to purchase services from other agents via x402, closing the loop.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 89' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.90',
    text: 'Any one of these primitives can be built in a weekend with the right libraries. But the compound effect of all five, pre-integrated and tested together, is what turns months of boilerplate into a single `npx create-revealui`.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 90' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.91',
    text: 'The five primitives are not independent features. They are a directed graph:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 91' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.92',
    text: 'Every edge in that graph is a piece of integration code you do not have to write. Every node is a piece of infrastructure you do not have to maintain. And because RevealUI is open source (MIT for the core, source-available for Pro), you can read every line, fork every module, and extend every API.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 92' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.93',
    text: 'Build your business, not your boilerplate.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 93' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/five-primitives',
    exportPath: 'body.94',
    text: '*RevealUI is the open runtime for businesses that run their own AI. The core, People, Content, Offers, and Payments, is MIT licensed and free forever. The Agents primitive (AI agents, memory, the MCP framework) is Fair Source (FSL-1.1-MIT), available with a Pro license. Learn more at [revealui.com](https://revealui.com).*',
    evidence: [
      { kind: 'code', ref: 'docs/blog/05-five-primitives.md', note: 'body source paragraph 94' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.0',
    text: "Most software companies accept a particular bargain without thinking about it: your secrets live in someone else's vault, your AI calls someone else's API, and your dev environment is a pile of global installs that one `npm install -g` can break.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.1',
    text: "RevealUI doesn't accept that bargain.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.2',
    text: "This post is about a different way to run a software business - one where your secrets are encrypted on your own machine, your AI inference runs on your CPU, and your development environment is fully reproducible. Not because you're paranoid, but because owning your stack is simply better engineering.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.3',
    text: "RevealUI's local-first story comes from four independent pieces that happen to compose cleanly:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.4',
    text: '| Layer | Technology | What it does | |-------|-----------|-------------| | **Secrets** | RevVault (age encryption) | Credentials stay on your machine, encrypted at rest | | **AI inference (default)** | Inference snaps / Ollama (open models) | Local LLM inference. Cloud-compatible providers (Groq, HuggingFace, OpenAI-compatible) are pluggable via env vars but opt-in. | | **Dev environment** | Nix flakes + direnv | Reproducible environment, zero manual tool installs | | **Business logic** | RevealUI | Auth, content, payments, AI agents - all wired |',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.5',
    text: 'Each layer independently solves a real problem. Together, they give you something genuinely unusual: a full business software stack with local AI that can run without a network connection.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.6',
    text: "RevVault: secrets that don't travel",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.7',
    text: 'RevealUI uses [RevVault](https://github.com/RevealUIStudio/revvault) for credential management. RevVault is an age-encrypted local secret store - a Git-friendly vault that keeps secrets on your filesystem, encrypted, and never phones home.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.8',
    text: "The practical upside: your `.env` never touches Vercel's secret storage, your CI system, or any third-party dashboard unless you put it there explicitly. The `.envrc` in every RevealUI project calls `revvault export-env` at shell entry - credentials are decrypted on the fly, used in memory, never written to disk in plaintext.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.9',
    text: 'Contrast this with the standard pattern: secrets in Vercel, AWS Secrets Manager, or a `.env` file checked into a private repo. All three involve trusting a third party with values that should only exist on hardware you control.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.10',
    text: 'Local inference: your models, your hardware',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.11',
    text: "RevealUI's AI agents run on open source models locally. The recommended path is **Ubuntu Inference Snaps** - Canonical's snap-packaged model serving with hardware-aware engine selection, signed packages, and zero configuration:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.12',
    text: 'Each snap serves an OpenAI-compatible API locally. The `@revealui/ai` package auto-detects the running snap and routes agent calls to it. The same agent orchestration, memory system, and MCP integrations work with any supported inference path - because they all expose OpenAI-compatible `/v1/chat/completions` endpoints.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.13',
    text: 'As a fallback, **Ollama** supports any open source GGUF model (default: `gemma4:e2b`):',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.14',
    text: 'No API key. No usage bill. No data leaving your machine.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.15',
    text: 'Nix: the environment that installs itself',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.16',
    text: 'RevealUI uses Nix flakes + direnv. The entire development environment - Node, pnpm, Biome, and all build dependencies - is declared in `flake.nix` and activated automatically when you enter the project directory.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.17',
    text: "No `apt install`, no `brew install`, no conda environment. Every developer on the project gets the same toolchain regardless of what's on their system. It works the same on a Ryzen laptop as it does on a Mac or a Linux CI runner.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.18',
    text: 'Here\'s the full picture of what "local-first RevealUI" looks like in practice:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.19',
    text: 'The entire business stack with local AI - People, Content, Offers, Payments, and Agents, running without a cloud API call in sight.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.20',
    text: 'The "local-first" configuration is one of several inference paths. RevealUI supports Ubuntu Inference Snaps (Canonical\'s managed runtime, planned recommended) and Ollama (any open source GGUF model, default local). Cloud-compatible providers (Groq, HuggingFace, and OpenAI-compatible endpoints) are pluggable but opt-in via env vars. Pick the path that fits your trust + cost profile; there is no vendor lock-in.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.21',
    text: "But there's a real and growing audience for whom those concerns matter:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.22',
    text: "**Bootstrapped developers** who can't absorb unpredictable LLM API costs as they scale",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.23',
    text: "**Agencies** building client software where the client's data can't transit third-party systems",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.24',
    text: '**Companies with data residency requirements**  -  healthcare, finance, legal, government',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.25',
    text: '**Developers in bandwidth-constrained environments**  -  offline-capable software, edge deployments',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.26',
    text: "**Anyone who has been burned by a provider sunset**  -  your inference doesn't disappear when a company pivots",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.27',
    text: "For these cases, RevealUI with local inference is the only full-stack agentic runtime option that doesn't require trusting a cloud provider with your most sensitive business data.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 27',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.28',
    text: "Running locally doesn't mean running poorly. The RevealUI agent stack has the same capabilities whether it's talking to a cloud model or a local Gemma 4 instance:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 28',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.29',
    text: '**Planning and tools**  -  agents can create todos, read and write files, execute shell commands',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 29',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.30',
    text: '**Memory**  -  episodic memory, working memory, CRDT-based persistence across sessions',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 30',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.31',
    text: '**MCP integrations**  -  13 first-party MCP servers (Stripe, Neon, Vercel, Playwright, Code Validator, Next.js DevTools, plus RevealUI-internal Content / Email / Memory / Stripe / Docs servers, the contracts introspection server, and the adapter base class)',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 31',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.32',
    text: '**Orchestration**  -  multi-agent coordination, sub-agent spawning, streaming',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 32',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.33',
    text: "What you do give up: the raw capability of a 70B+ cloud model. Smaller local models like Gemma 4 are excellent for structured tasks - code generation, data processing, form filling, API orchestration - but won't match a frontier model on open-ended reasoning. For most business automation use cases, that's an acceptable trade.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 33',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.34',
    text: 'See [Local-First Setup](/local-first) for the step-by-step guide: hardware requirements, Nix setup, inference snaps / Ollama installation, connecting `@revealui/ai`, and configuring RevVault.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 34',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/local-first-ai-stack',
    exportPath: 'body.35',
    text: '*RevealUI is MIT licensed and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/04-local-first-ai-stack.md',
        note: 'body source paragraph 35',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.0',
    text: 'I built most of RevealUI with three Claude Code instances running simultaneously.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.1',
    text: 'One in a terminal at the project root, handling builds, deployments, and database migrations. One in the IDE, doing code editing and documentation. One in a second terminal, running the CI gate and catching anything the others missed.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.2',
    text: 'The problem: they kept overwriting each other.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.3',
    text: 'Agent A would be mid-way through refactoring `packages/auth/src/server/oauth.ts`. Agent B, working independently, would open the same file to fix an unrelated import, save its version, and clobber everything A had done. Neither agent knew the other existed. There was no shared state, no communication channel, no way for one to know the other was mid-edit.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.4',
    text: "The simple fix - run one agent at a time - eliminates the parallelism that makes the three-agent setup valuable in the first place. If each agent has to wait for the others to finish, you've got sequential work with extra steps.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.5',
    text: 'What I needed was a coordination protocol. Not a distributed lock system. Not an event bus. Something lightweight, file-based, readable by humans and agents alike.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.6',
    text: 'The solution is a markdown file: `.claude/workboard.md`.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.7',
    text: "Each agent registers itself when it starts. Each agent claims the files it's working on. Before opening a file to edit, an agent checks whether another session has claimed it.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.8',
    text: "That's it. No daemon. No network calls. No distributed state. A markdown table.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.9',
    text: 'The registration happens via a Claude Code hook - a shell script that runs on session start:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.10',
    text: 'The `CLAUDE_AGENT_ROLE` environment variable identifies which agent is which. In `.envrc`:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.11',
    text: 'In the terminal launch script:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.12',
    text: 'Every agent gets a stable identity across restarts.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.13',
    text: 'The conflict-prevention mechanism is file claiming. When an agent starts editing a set of files, it stamps its row in the workboard:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.14',
    text: 'A second agent, before editing `packages/db/src/schema/marketplace.ts`, reads the workboard and sees that `zed-revealui` has claimed that directory. It either waits, picks a different task, or asks the human to resolve the conflict.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.15',
    text: "The ownership is advisory, not enforced. There's no lock that prevents writes. The protocol relies on agents actually checking before editing - which Claude Code does naturally when given the workboard context. If an agent is going to edit a claimed file, it knows to coordinate first.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.16',
    text: 'This is the right level of enforcement. Hard locks create deadlocks. Advisory ownership surfaces conflicts without blocking work.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.17',
    text: 'File ownership stamps update automatically via a PostToolUse hook that fires after every file write:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.18',
    text: 'No manual tracking. The agent edits a file, the hook updates the workboard. Other agents see the claim on their next workboard read.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.19',
    text: 'Agents crash. Sessions time out. The workboard accumulates ghost entries.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.20',
    text: 'The session-start hook prunes stale rows before registering the new session:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.21',
    text: "Sessions that haven't written to the workboard in seven days are considered dead and pruned. Their file claims are released. (We started at four hours; vacation-length absences pushed it to seven days.)",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.22',
    text: "What This Solves (and Doesn't)",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.23',
    text: 'This protocol solves the most common multi-agent problem: two agents editing the same file concurrently without knowing it. It catches this early - before the edit happens - by surfacing the claim in the workboard context.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.24',
    text: "It doesn't solve everything:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.25',
    text: '**Race conditions at the second level** - two agents both reading a file, deciding no one else owns it, and both claiming it simultaneously. This is possible but rare in practice. The workboard read-claim-write cycle is fast, and human developers tend to assign tasks to agents sequentially ("now you do X, now you do Y") rather than launching them simultaneously on the same files.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.26',
    text: '**Semantic conflicts** - two agents editing different files that depend on each other. Agent A changes a function signature; Agent B calls that function in another file. No file-level conflict, but a broken build. The CI gate catches this, which is why the gate runs continuously in the third terminal.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.27',
    text: '**Correctness of claims** - an agent might claim files it ends up not editing, blocking other agents unnecessarily. In practice this is fine: claims are scoped to the current task, and task scope is usually clear.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 27',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.28',
    text: 'The `@revealui/harnesses` Package',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 28',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.29',
    text: 'We extracted the workboard protocol into a proper package: [`@revealui/harnesses`](https://github.com/RevealUIStudio/revealui/tree/main/packages/harnesses).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 29',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.30',
    text: "**How this evolved.** RevealUI's own coordination has matured past the exact hooks above: today the Claude Code hooks *read and warn* rather than write the workboard, agents maintain it directly, and a coordination daemon tracks live session state over RPC. The file-based workboard stays the durable, greppable, git-committed archive layer, which is the part that mattered most. `@revealui/harnesses` ships the productized version.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 30',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.31',
    text: '`WorkboardManager` handles the low-level parsing directly, for callers that want to register sessions and claim files programmatically rather than through the CLI:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 31',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.32',
    text: 'The package also includes adapters for Claude Code, Cursor, and GitHub Copilot - so you can coordinate across different AI tools on the same codebase.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 32',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.33',
    text: 'The hooks live in `~/.claude/hooks/` and are wired in `~/.claude/settings.json`. The workboard itself is just a markdown file you check into your repo at `.claude/workboard.md`.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 33',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.34',
    text: "If you're running multiple AI coding agents on the same codebase, the workboard protocol is the lowest-overhead coordination mechanism I've found. It's readable by humans, greppable, diffable, and doesn't require any infrastructure beyond a shared filesystem.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 34',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.35',
    text: 'The `@revealui/harnesses` package is part of RevealUI Pro. The protocol itself - the markdown format, the hook scripts, the coordination rules - is documented in full in the [RevealUI repo](https://github.com/RevealUIStudio/revealui/blob/main/docs/PRO.md) and free to implement yourself.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 35',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/multi-agent-coordination',
    exportPath: 'body.36',
    text: '*RevealUI is the open runtime for businesses that run their own AI. [revealui.com](https://revealui.com)*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/03-multi-agent-coordination.md',
        note: 'body source paragraph 36',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.0',
    text: "**Coming soon, not yet live (roadmap, tracked in [#93](https://github.com/RevealUIStudio/revealui/issues/93)):** x402 payments in RevealUI are **designed and code-complete but dormant** today. The feature flag `X402_ENABLED=false` is the default; the endpoints exist but won't transact. Stripe live mode is already on for first-party billing; x402 agent payments remain behind the flag until that surface ships. See [What Works Today](../WHAT_WORKS_TODAY.md) for current shipping status. This post explains the design and how to wire it; it does not claim x402 payments are currently transactable through RevealUI in production.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 0' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.1',
    text: 'HTTP 402 is the status code that was never used.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 1' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.2',
    text: 'It\'s been in the spec since 1996. The RFC says it\'s "reserved for future use" and the intended use was always some form of payment. For 30 years, practically nobody sent it. The web settled on subscription models and API keys - you authenticate with a token, and billing happens out-of-band via Stripe.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 2' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.3',
    text: 'That model works fine for most APIs. But it breaks down for AI agent systems, where:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 3' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.4',
    text: 'Calls happen autonomously, not from a human clicking a button',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 4' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.5',
    text: 'The caller might be a different agent than the one that holds the API key',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 5' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.6',
    text: 'You want granular per-call pricing, not flat subscriptions',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 6' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.7',
    text: 'Payment is better handled at the protocol level than the application level',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 7' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.8',
    text: "The [x402 protocol](https://x402.org) - developed by Coinbase - finally gives 402 a real use. Here's the design we have built in RevealUI and how it will work once x402 ships, and why it's the right model for AI-native APIs.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 8' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.9',
    text: "The protocol is simple. A caller makes a request to a metered endpoint. If they haven't paid, they get a 402 with a payment descriptor in the header:",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 9' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.10',
    text: "The `maxAmountRequired` is in the asset's smallest unit - for USDC (6 decimals), `10000` = $0.01. The `asset` address is USDC on Base. The `payTo` is your receiving address.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 10' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.11',
    text: 'The caller pays the required amount on-chain, then retries the request with a signed payment proof in the header:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 11' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.12',
    text: 'The server verifies the proof against the x402 facilitator at `https://x402.org/facilitator`, and if valid, processes the request. The whole cycle takes a few seconds - fast enough to be invisible inside an agent loop.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 12' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.13',
    text: "We wire x402 into the A2A task endpoints in RevealUI's API. The middleware runs after quota checking. If quota is exceeded and `X402_ENABLED` is true, we return 402 instead of 429:",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 13' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.14',
    text: 'The middleware on the task endpoint:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 14' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.15',
    text: 'From the caller side, the Coinbase x402 SDK handles the whole cycle automatically:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 15' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.16',
    text: "One line of setup. The SDK intercepts 402 responses, pays on-chain, retries. The caller doesn't need to manage any of this manually.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 16' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.17',
    text: 'The cleaner application of x402 in RevealUI is the MCP Marketplace (coming soon, tracked in [#526](https://github.com/RevealUIStudio/revealui/issues/526)).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 17' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.18',
    text: "Developers publish Model Context Protocol servers to the marketplace with a per-call USDC price. Callers invoke them through RevealUI's proxy - which handles payment verification and SSRF protection - and the developer earns 80% of each call.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 18' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.19',
    text: "Each invocation goes through x402 automatically. The developer's actual server URL is never exposed - callers invoke via the RevealUI proxy, which verifies payment before forwarding. Revenue accumulates in the `marketplace_transactions` table and flows to the developer via Stripe Connect.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 19' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.20',
    text: 'The price-setting logic matters. For a `pricePerCallUsdc` of `"0.005"`:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 20' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.21',
    text: 'Six-decimal precision matters at micropayment scale. A call priced at `0.001` USDC (one tenth of a cent) with 20% platform fee: developer earns `0.0008` USDC. You need to round correctly or floating-point drift accumulates across thousands of calls.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 21' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.22',
    text: 'Why This Matters for AI Agents',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 22' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.23',
    text: 'The subscription model has a fundamental mismatch with AI agents: agents make autonomous calls, and the entity paying for those calls (the person running the agent) is often different from the entity holding the API key (whoever originally set up the integration).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 23' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.24',
    text: "With x402, the wallet is the identity. An agent running inside a customer's infrastructure pays directly from the customer's wallet for each call it makes. There's no shared API key to manage. No rate limits to distribute across tenants. No billing reconciliation at the end of the month.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 24' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.25',
    text: 'It also solves the "cold start" problem for API monetization. Traditionally, if you want to charge for an API, you need Stripe, a billing portal, subscription management, and an API key system - weeks of work before you can accept your first dollar. With x402, you add one middleware function and set a receiving address. That\'s it.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 25' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.26',
    text: "This is early. The tooling is still rough. Not every developer wants to deal with on-chain payments. But for AI-native infrastructure - where calls are autonomous, granular, and high-volume - it's a better model than what we've had.",
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 26' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.27',
    text: 'When x402 ships, it will be off by default. You will enable it with a few environment variables:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 27' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.28',
    text: 'When disabled, the existing 429 quota behavior is unchanged. When enabled, quota exhaustion returns 402 with payment details instead.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 28' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.29',
    text: 'The full source is in [`apps/server/src/middleware/x402.ts`](https://github.com/RevealUIStudio/revealui/blob/main/apps/server/src/middleware/x402.ts) and the marketplace implementation in [`apps/server/src/routes/marketplace.ts`](https://github.com/RevealUIStudio/revealui/blob/main/apps/server/src/routes/marketplace.ts).',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 29' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.30',
    text: 'What This Means for Pricing',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 30' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.31',
    text: 'HTTP 402 and x402 are not a replacement for subscriptions. They are the missing transaction layer for an agent-first internet.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 31' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.32',
    text: 'The pricing model that fits 2027-2030 is hybrid:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 32' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.33',
    text: 'account/workspace subscription for platform access',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 33' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.34',
    text: 'metered agent labor for autonomous work',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 34' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.35',
    text: 'protocol-level or marketplace-level payment for discrete paid calls',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 35' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.36',
    text: 'explicit commerce pricing when agents complete economic actions',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 36' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.37',
    text: 'premium pricing for trust, governance, and compliance',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 37' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.38',
    text: 'That is materially better than classic per-seat SaaS for agent systems because the thing creating value is no longer only the human seat. The value is digital labor, transaction flow, and governed autonomy.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 38' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.39',
    text: 'In RevealUI, the long-term goal is to make x402 one pricing primitive among several:',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 39' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.40',
    text: 'subscriptions handle recurring platform value',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 40' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.41',
    text: 'meters handle predictable usage expansion',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 41' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.42',
    text: 'x402 handles direct paid invocation',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 42' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.43',
    text: 'marketplace and commerce rails handle transaction-linked monetization',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 43' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.44',
    text: 'The important constraint is ethical billing: failed or replayed calls should not be billable, and agent-spend systems need auditable controls before they deserve trust.',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 44' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/http-402-payments',
    exportPath: 'body.45',
    text: '_RevealUI is the open runtime for businesses that run their own AI. [revealui.com](https://revealui.com)_',
    evidence: [
      { kind: 'code', ref: 'docs/blog/02-http-402-payments.md', note: 'body source paragraph 45' },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.0',
    text: "I've started three software companies. Each time, I spent the first three to six months building the same thing: user authentication, a content management system, billing integration, an admin dashboard, role-based access control. The actual product (the thing that made the company worth existing) didn't get serious development time until month four at the earliest.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 0',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.1',
    text: "That's not a skills problem. That's an infrastructure problem. And after the third time, I decided to solve it.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 1',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.2',
    text: 'RevealUI is the open runtime for businesses that run their own AI. People, Content, Offers, Payments, and Agents (the five primitives every product needs) are pre-wired, open source, and ready to deploy. One codebase. One deployment. Zero months wasted on plumbing.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 2',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.3',
    text: 'The problem nobody talks about',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 3',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.4',
    text: 'Every software company needs the same five things on day one:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 4',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.5',
    text: '**People** - sign up, sign in, sessions, roles, permissions (RBAC + ABAC)',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 5',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.6',
    text: '**Content** - pages, posts, media, rich text, an API to serve it',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 6',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.7',
    text: '**Offers** - a catalog, pricing tiers, license keys',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 7',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.8',
    text: '**Payments** - checkout, subscriptions, invoices, a billing portal',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 8',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.9',
    text: '**Agents** - AI that actually knows your business context',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 9',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.10',
    text: 'None of these are your product. All of them are required before your product can exist.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 10',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.11',
    text: 'The "modern stack" answer is to stitch together a dozen SaaS tools. Clerk for auth. Stripe for payments. Contentful or Sanity for content. An admin framework like Retool or AdminJS. Maybe a hosted AI API for the intelligence layer. Each tool has its own API, its own billing, its own breaking changes, and its own vendor lock-in.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 11',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.12',
    text: "You end up spending your first months as a system integrator, not a product builder. You're reading five different sets of docs, managing five different API keys, handling five different webhook formats, and praying that the auth provider's session token format is compatible with whatever your admin expects.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 12',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.13',
    text: "I've watched teams burn entire quarters just getting Clerk sessions to propagate correctly to their Payload admin instance while Stripe webhooks fire into a custom endpoint that has to manually reconcile user IDs across three different systems. That's not building a product. That's plumbing.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 13',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.14',
    text: 'Why existing solutions fall short',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 14',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.15',
    text: "Let me be specific about what's out there and why none of it solved my problem.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 15',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.16',
    text: '**Headless admin platforms** (Payload, Strapi, Contentful) are excellent at content. Payload in particular is beautifully designed. I have genuine respect for the team. But an admin solves one of the five primitives. You still need auth (yes, Payload has auth, but try integrating it with Stripe tier-gated access control). You still need billing. You still need a product catalog. You still need feature gating that ties your license tier to what content and features a user can access.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 16',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.17',
    text: "**Auth services** (Clerk, Auth0, NextAuth) solve identity. But identity without authorization is half the story. Can this user access this content? Are they on the Pro tier? Has their subscription lapsed? Did they exceed their API rate limit? These questions require auth to know about billing, and billing to know about features. A standalone auth service can't answer them.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 17',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.18',
    text: "**Stripe** handles payments brilliantly. But you still need to build the pricing page that renders tier data, the license key system that enforces access, the webhook handler that updates user roles when a subscription changes, and the billing portal UI that lets users manage their plan. Stripe gives you the engine; you're still building the car.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 18',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.19',
    text: "**Boilerplates and starter kits** get you 60% of the way and then leave you maintaining someone else's code decisions for the next two years. They're a snapshot in time. They don't get security patches. They don't evolve.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 19',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.20',
    text: "The fundamental issue is that these tools were designed in isolation. They don't know about each other. The integration burden falls entirely on you.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 20',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.21',
    text: 'RevealUI treats those five primitives as a single, cohesive system. The architecture follows six engineering principles that govern every decision: **Justifiable** (every default earns its place), **Orthogonal** (clean separation between packages), **Sovereign** (you own everything, deploy anywhere), **Hermetic** (sealed boundaries between concerns), **Unified** (one schema, zero drift), and **Adaptive** (AI and extensibility built into the foundation, not bolted on).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 21',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.22',
    text: "I want to be clear about something: I'm not claiming this is the only way to build software. I'm saying it's *a* way, one that I've tested across three companies and thousands of decisions. If you're staring at a blank repo wondering which ORM, which auth strategy, which deployment model, these six principles give you a defensible answer for each one. Start here. Evolve from here. The principles are starting coordinates, not a cage.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 22',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.23',
    text: "Here's what that looks like in practice.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 23',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.24',
    text: 'The CLI walks you through database setup, storage, payment configuration, and dev environment preferences. A few minutes later, you have a running application with auth, content management, a REST API, and (if you provided a Stripe key) a fully wired billing system.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 24',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.25',
    text: 'Content in RevealUI is defined through collections (typed, access-controlled, hookable data structures):',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 25',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.26',
    text: "That's the full definition. Access control, hooks, field validation, and relationship resolution are all declared in one place. The REST API, admin UI, and TypeScript types are derived from this definition automatically.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 26',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.27',
    text: 'Feature gating that actually works',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 27',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.28',
    text: 'This is where the "integrated system" matters most. RevealUI\'s feature flags are tied directly to license tiers:',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 28',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.29',
    text: 'The feature system knows the tier hierarchy. The tier hierarchy knows about Stripe. Stripe webhooks update the license in real time. When a user upgrades from Free to Pro, their feature flags update immediately. No manual reconciliation, no cache invalidation dance, no "please refresh the page."',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 29',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.30',
    text: "Here's the tier map, straight from the source:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 30',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.31',
    text: 'Free tier gets the full runtime engine, auth, the REST API, and local AI inference (Inference Snaps or Ollama, no API key, no cloud bill). Pro unlocks AI agents, payments, sync, MCP, and the monitoring dashboard. Max adds AI memory and advanced inference configuration. Enterprise adds multi-tenant management, RevealUI Fleet (branded white-label via RevForge), and Enterprise SSO (OIDC + SAML SP-initiated; operator guide [FORGE_SSO_SETUP](../FORGE_SSO_SETUP.md); tracker [#449](https://github.com/RevealUIStudio/revealui/issues/449)).',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 31',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.32',
    text: 'Pricing served from a single source, not hardcoded',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 32',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.33',
    text: 'One thing I got wrong early on: I hardcoded prices in the frontend. Then I changed them. Then I forgot to update one of the three places they appeared. Never again.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 33',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.34',
    text: "RevealUI serves tier and pricing data from a single API endpoint. The contracts package defines the tier structure and feature lists; the API route merges in live prices from Stripe when it's configured:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 34',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.35',
    text: 'The marketing site, admin billing page, and upgrade prompts all read from this endpoint. Subscription prices come from Stripe when configured; the public price points are being finalized ahead of launch, so the endpoint serves tier structure and feature lists today. The contracts package is the single source of truth. Change the structure in one place and it propagates everywhere. No duplication.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 35',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.36',
    text: 'Auth without the complexity',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 36',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.37',
    text: 'RevealUI uses session-based auth. No JWTs. No token rotation. No "your refresh token expired and now the user is logged out mid-checkout."',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 37',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.38',
    text: 'Sessions are stored server-side. The cookie is `httpOnly`, `secure`, `sameSite=lax`, scoped to `.revealui.com` for cross-subdomain access. Password hashing uses bcrypt with 12 rounds. Rate limiting and brute force protection are built in. OAuth works with GitHub, Google, and Vercel out of the box.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 38',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.39',
    text: "I made this choice deliberately. JWTs are appropriate for distributed microservice architectures where services can't share a session store. RevealUI is a monolithic deployment where the admin, API, and auth layer all run in the same process or share the same database. Sessions are simpler, more secure (instant revocation), and eliminate an entire class of bugs around token expiry and refresh races. License keys are a separate story. Those are signed JWTs (EdDSA/Ed25519) because they're verified offline by self-hosted deployments. Different problem, different tool.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 39',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.40',
    text: 'MIT. Non-negotiable for the core.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 40',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.41',
    text: "I've been on the other side of this equation. I've built production systems on commercial platforms that raised their prices 3x, changed their API without warning, or got acquired and sunset. Every time, I wished I had the source code.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 41',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.42',
    text: "RevealUI's business primitives (auth, content, collections, the REST API, the admin dashboard, the CLI, the component library) are MIT licensed. You can inspect every line. You can fork it. You can self-host it on your own infrastructure. You can rip out the parts you don't need and keep the parts you do.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 42',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.43',
    text: 'The business model is straightforward: the Pro tier (AI agents, the memory system, the MCP framework, open-model orchestration) funds ongoing development. The things that make RevealUI useful for most use cases are free forever. The things teams need for AI capabilities are commercially licensed but source-available.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 43',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.44',
    text: "To be precise about the split: 24 of the 31 packages are MIT, forever. The five Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, and `@revealui/services`) are Fair Source under FSL-1.1-MIT: source-visible, commercially usable, and they convert to MIT two years after each release. Two workspace packages carry no public license: internal build tooling and an Apify actor scaffold. MCP integration is a Pro capability today, not a free add-on. I'd rather be honest about where the line sits than blur it. You can read every line of the Pro code on npm; the license key unlocks the features, it doesn't hide the source.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 44',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.45',
    text: 'What makes RevealUI different',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 45',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.46',
    text: "RevealUI is not an admin with plugins bolted on. It's not a boilerplate you clone and hack. It's a cohesive system designed from the ground up so that every primitive knows about every other primitive. This is the **Unified** and **Hermetic** design principles in practice. One schema is shared across every layer, with sealed boundaries between concerns so auth never leaks into billing and content never tangles with payments.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 46',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.47',
    text: "When a user signs up, the auth system creates their session, assigns their default role, and checks their license tier. When they access content, the collection's `access.read` function can reference their tier, their role, or any custom claim. When they upgrade via Stripe, the webhook handler updates their license, which updates their feature flags, which unlocks gated content and capabilities, all in the same request cycle.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 47',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.48',
    text: "This is the part that's genuinely hard to replicate by stitching services together. The integration isn't in the glue code between separate tools. The integration is in the data model. People, content, offers, payments, and agents share a schema. They share a database. They share a session. The relationships are first-class, not afterthoughts.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 48',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.49',
    text: "Some numbers on what's actually shipped:",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 49',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.50',
    text: '**37 workspaces** across the monorepo (6 apps, 31 packages with 24 MIT, 5 Fair Source, 2 internal)',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 50',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.51',
    text: '**101 database tables** via Drizzle ORM on NeonDB (Postgres)',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 51',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.52',
    text: '**65 UI components** in `@revealui/presentation`, with one third-party runtime dependency (`tailwind-merge`), built directly on Tailwind v4 and React, with `cva` and `cn` vendored in-package',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 52',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.53',
    text: '**13 first-party MCP servers** in `@revealui/mcp`',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 53',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.54',
    text: '**Unit, integration, and E2E tests** across the monorepo (run `pnpm test` for the current count)',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 54',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.55',
    text: '**Full OpenAPI spec** with Swagger UI at `/docs`',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 55',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.56',
    text: '**Session auth** with bcrypt, rate limiting, brute force protection, and OAuth',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 56',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.57',
    text: "I want to be honest about where RevealUI is and isn't the right choice.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 57',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.58',
    text: "**It's opinionated.** That's the **Justifiable** principle. Every choice has a reason you can explain in one sentence. React 19, Next.js 16, Hono, Drizzle ORM, NeonDB, Tailwind v4. If you need Vue or Svelte on the frontend, RevealUI isn't for you today. The API layer (Hono) is framework-agnostic and serves standard REST, so you could consume it from any frontend. But the admin dashboard is React. The point isn't that these are the *right* choices for every team. It's that they're a coherent set of choices that work well together. When your needs outgrow a specific tool, swap it. The **Orthogonal** architecture means nothing is welded shut.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 58',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.59',
    text: "**It's early.** This is a v0. The core is stable (unit and integration tests, full TypeScript strict mode, security hardening). Run `pnpm test` for the current count. **Stripe is live** in production. The third-party plugin marketplace is still early. The template library is small. The community is just getting started. I keep an honest, file-by-file account of what does and doesn't work at [What Works Today](../WHAT_WORKS_TODAY.md).",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 59',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.60',
    text: "**It's a solo project.** I'm one developer at RevealUI Studio. The upside is that decisions are fast and the vision is coherent. The downside is that there's one person triaging issues and reviewing PRs. I'm building in public precisely because I need the community to grow with the project.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 60',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.61',
    text: "**It's not serverless-native.** RevealUI assumes a database. It assumes persistent sessions. It works great on Vercel (that's where the studio's own sites run), but it's not a collection of edge functions with no state. The architecture is a traditional web application deployed to modern infrastructure. I think that's the right trade-off for a system that needs ACID transactions across auth, billing, and content.",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 61',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.62',
    text: 'The repository is public on GitHub. The docs site is live at [docs.revealui.com](https://docs.revealui.com). The `create-revealui` CLI is on npm. You can stand up a full RevealUI instance today.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 62',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.63',
    text: 'RevDev Studio (Tauri + React) is the native AI experience for agent coordination, local inference management, and a visual dashboard. A terminal client (Go + Bubble Tea) gives you a TUI for API access and license lookups.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 63',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.64',
    text: 'The near-term roadmap includes MCP server registry listings, A2A agent discovery for RevealUI-to-RevealUI communication, a broader template library, and a template marketplace where developers can publish project starters. The community lives on [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions), so join early and help shape what gets built next.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 64',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.65',
    text: "But the core thesis won't change: **every software company needs People, Content, Offers, Payments, and Agents. You shouldn't have to build them from scratch.**",
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 65',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.66',
    text: 'Build your business, not your boilerplate.',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 66',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.67',
    text: '*RevealUI is MIT licensed (Pro packages are Fair Source, FSL-1.1-MIT) and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 67',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
  {
    file: 'blog/why-we-built-revealui',
    exportPath: 'body.68',
    text: '*If you have questions, find a bug, or want to contribute, open an issue or reach out at founder@revealui.com.*',
    evidence: [
      {
        kind: 'code',
        ref: 'docs/blog/01-why-we-built-revealui.md',
        note: 'body source paragraph 68',
      },
      {
        kind: 'test',
        ref: 'apps/marketing/app/lib/__tests__/blog-body.test.ts#body prose units match extractor',
        note: 'extractor lockstep for blog body corpus',
      },
    ],
  },
] as const;

/** @deprecated Use blogBodyClaims. */
export const blogBodyClaimsP2 = blogBodyClaims;
