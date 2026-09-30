---
title: "The open runtime for forward-deployed agent work"
description: "Demos die at the customer wall. Forward deployed work only finishes when the customer still owns the runtime after you leave."
visibility: public
status: narrative
lastUpdated: "2026-09-30"
audience: user
author: Joshua Vaughn
---

Most agent software is easy to demo and hard to leave behind. The customer has a working prototype, a real data boundary, and one fair question: if you walk away, what do they still own?

Palantir coined the title for the people who answer that in the field. The rest of the industry caught up. OpenAI, Anthropic, Google, Databricks, Salesforce, and a long line of vertical AI companies hire forward deployed engineers because demos do not deploy themselves. a16z called the same motion the hottest job in startups for a reason: complex AI needs implementation.

A hosted product and a customer-controlled deployment offer different handoffs. RevealUI is the self-hosted runtime built for a different handoff. Your business and the agents that run it live under one roof. The design goal is agents governed through the same business system as your team. Actual permissions and recording depend on the configured workflow. Studio's job is the forward-deployed practice on that runtime: stamp, wire, hand over, leave the keys.

## The job is bigger than one company

Palantir named the role. By 2026 the hiring market owns it. Labs, data platforms, vertical AI companies, defense tech, and consultancies all staff people whose job is to make agent demos survive real data, real compliance, and real operators.

The same work shows up under different badges: Forward Deployed Engineer, Applied AI Engineer, Deployment Engineer. Filter on the scenario, not the title. A working agent demo dies at the customer wall: their data, their cloud, their compliance fear, and the fair question of who owns the system when the embed ends.

## The failure mode is a vendor stack you cannot keep

A hosted implementation can be a useful choice. For a self-hosted handoff, assess what the customer retains: accounts, project source, data, licensed software, and operating notes.

A different one: the deployer leaves a runtime the **customer** owns. The agents keep running after the visit. The data stays where the customer put it. The record of what agents did is something the customer can inspect.

## What has to be true for handoff

Five things, not a slogan:

1. **Customer-owned deploy.** The product runs on infrastructure they control, not only on a hosted demo tenant.
2. **Business primitives already in the runtime.** Auth, content, offers, payments, and agents are not a greenfield rewrite per engagement.
3. **Agents as governed users.** Same identity and policy surface as people, not shadow scripts with a private side channel.
4. **A record the customer can inspect.** Configure audit signing for supported actions. Pro adds downloadable Merkle roots and inclusion proofs; anchoring can lag. This is inspectability, not certification.
5. **Provider choice.** The model is not the lock-in. Closed APIs stay opt-in adapters.

If any of those are missing, the handoff is a laptop dependency with a nicer name.

## Who this is for

- Owner-operators who *are* their own forward-deployed person
- Independent deployers and small studios who will never be a lab's FDE headcount but do the same job
- Agencies and MSPs who productize the motion for clients

Who this is not for: six-month enterprise POCs that need a certification stamp before a first install. That path exists elsewhere. It is not the first-mile product.

## What Studio ships into the field

RevealUI Studio offers Consultation, Pilot, and Launch: a focused review, one implemented action, or one business workflow. Agree on deliverables and maintenance responsibilities before work starts. Product licenses are separate.

You can read the runtime, run it, and check the claims against code. Used in production by the team that maintains it. That is the only production claim this post makes.

## Leave the keys

The industry already decided last-mile humans matter. The open question is what they leave behind.

RevealUI's approach is a self-hosted runtime for business data and supported agent workflows. Configure the tools, permissions, and action records your workflow needs, and review license and service dependencies before handoff.

Start with the source: [github.com/RevealUIStudio/revealui](https://github.com/RevealUIStudio/revealui). Or start a conversation about a fixed-bid engagement at [revealuistudio.com](https://revealuistudio.com).
