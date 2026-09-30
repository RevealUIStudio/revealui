---
title: "Run Your Admin by Talking to It"
description: "Open the RevealUI admin, type what you want done, and watch the agent do it, with streaming output and full tool visibility."
visibility: public
status: narrative
lastUpdated: "2026-09-30"
audience: user
author: Joshua Vaughn
---

An admin task can start with a sentence.

"Draft a post about our Q2 launch and save it as a draft." "How many users signed up last week?" "Mark every ticket from the demo account as resolved." In the RevealUI admin, you type that into a chat panel and the agent does it, in front of you, with every step it takes visible as it happens.

This is Dashboard Agent Chat, and it ships today in the admin dashboard.

## What it does

The agent lives inside the admin you already use. From the chat panel it can create and edit content, query your data, manage collections, and run multi-step workflows, all through natural language. You get streaming responses so you see the work as it unfolds, full visibility into which tools it called, and a conversation history so you can pick up where you left off.

It is not a chatbot bolted onto a sidebar that can only answer questions. It operates your business, on the same data, through the same API your team uses.

## Why it works: collections are already tools

The reason this needed almost no new surface area is the architecture underneath. In RevealUI, every collection you define is automatically exposed as a tool an agent can call. Define a `Posts` collection and you get a REST API, an admin UI, and an agent-callable tool, simultaneously, from one definition.

So when you ask the agent to draft a post, it is not reaching through a special integration. It is calling the exact same create-post operation a human triggers from the dashboard. There is no separate "agent path" to keep in sync with the real one.

That last part matters, and it is also today's limitation. This essay originally described the session-bound implementation. For the current release, inspect the enabled tools, identity and permission configuration, and audit coverage in your deployment. Do not assume a separate agent identity or complete action recording from the chat interface alone.

## It runs on your models, not someone's API

The agent streams its work over Server-Sent Events, and the inference behind it is yours to choose. Configure the inference provider explicitly. The environment factory selects configuration rather than probing installed runners; a configured Groq key can take precedence over Ollama when no provider is specified.

```ts
// Select the intended provider in configuration; the runner must be reachable.
const llmClient = createLLMClientFromEnv();
```

With local inference configured, model requests go to your selected local endpoint. You supply the hardware and runner. Hosted model providers process requests sent to them and have their own usage costs; other services can still require network access.

## The honest scope

Dashboard Agent Chat is a Pro-tier feature. Agent orchestration requires the appropriate paid entitlement and configured model access. Check the selected tier and enabled tools before evaluating a workflow.

And because it runs on open-weight models by design, set your expectations accordingly. Model performance depends on the chosen model, tools, and workflow. Evaluate a representative task and inspect its actions before relying on it in your business.

## Try it

Spin up a RevealUI instance, open the admin, and ask it to do something. Watching your admin act on a plain-English instruction, with every tool call shown and every permission respected, is the moment the "agentic business runtime" stops being a tagline and starts being a tool you reach for.

---

*RevealUI is the open runtime for businesses that run their own AI. See what the admin can do in the [docs](https://docs.revealui.com), or compare tiers on the [pricing page](https://revealui.com/pricing).*
