---
title: "Run Your Admin by Talking to It"
description: "Open the RevealUI admin, type what you want done, and watch the agent do it, with streaming output and full tool visibility."
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

The fastest admin interface is a sentence.

"Draft a post about our Q2 launch and save it as a draft." "How many users signed up last week?" "Mark every ticket from the demo account as resolved." In the RevealUI admin, you type that into a chat panel and the agent does it, in front of you, with every step it takes visible as it happens.

This is Dashboard Agent Chat, and it ships today in the admin dashboard.

## What it does

The agent lives inside the admin you already use. From the chat panel it can create and edit content, query your data, manage collections, and run multi-step workflows, all through natural language. You get streaming responses so you see the work as it unfolds, full visibility into which tools it called, and a conversation history so you can pick up where you left off.

It is not a chatbot bolted onto a sidebar that can only answer questions. It operates your business, on the same data, through the same API your team uses.

## Why it works: collections are already tools

The reason this needed almost no new surface area is the architecture underneath. In RevealUI, every collection you define is automatically exposed as a tool an agent can call. Define a `Posts` collection and you get a REST API, an admin UI, and an agent-callable tool, simultaneously, from one definition.

So when you ask the agent to draft a post, it is not reaching through a special integration. It is calling the exact same create-post operation a human triggers from the dashboard. There is no separate "agent path" to keep in sync with the real one, which means the agent cannot do anything your own access control does not already allow.

That last part matters. Every action the agent takes is governed by the same RBAC and ABAC rules that govern your users, and every operation is attributed in the audit log. The agent does not get a backstage pass. It gets a seat with the same permissions as the account it is acting for.

## It runs on your models, not someone's API

The agent streams its work over Server-Sent Events, and the inference behind it is yours to choose. RevealUI auto-detects the inference path at runtime, preferring a local Ubuntu Inference Snap and falling back to Ollama, both running open-weight models on your own hardware.

```ts
// The runtime picks the available local backend automatically.
const llmClient = createLLMClientFromEnv(); // snap, else Ollama
```

No proprietary API key. No per-token cloud bill. No customer data leaving your machine to reach a frontier model. If you would rather point it at a cloud-compatible endpoint, that is a single environment variable, but it is opt-in, never the default.

## The honest scope

Dashboard Agent Chat is a Pro-tier feature. The AI engine that powers it loads only for licensed deployments, so a free-tier install never pulls the agent code into memory at all.

And because it runs on open-weight models by design, set your expectations accordingly. These models are excellent at the structured work an admin is full of: drafting and editing content, querying and summarizing data, filling fields, orchestrating a sequence of API calls. They are not a frontier reasoning engine, and we would rather you know that than be surprised by it. For the daily operation of a business, structured and reliable is exactly the right trade.

## Try it

Spin up a RevealUI instance, open the admin, and ask it to do something. Watching your admin act on a plain-English instruction, with every tool call shown and every permission respected, is the moment the "agentic business runtime" stops being a tagline and starts being a tool you reach for.

---

*RevealUI is the open runtime for businesses that run their own AI. See what the admin can do in the [docs](https://docs.revealui.com), or compare tiers on the [pricing page](https://revealui.com/pricing).*
