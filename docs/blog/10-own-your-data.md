---
title: "Your Database, Your Storage, Your Sync"
description: "*By Joshua Vaughn, RevealUI Studio*"
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

Most "modern data stacks" charge a quiet tax: lock-in. The database speaks a proprietary dialect, so your queries do not move. The file storage is a vendor blob API with no standard underneath, so your uploads do not move. Real-time sync is a separate SaaS you wire in by hand, so your live data lives somewhere you do not control. Each choice is reasonable on its own. Together they mean that the day you want to leave, you cannot.

RevealUI takes the opposite position on every one of those. The database is standard Postgres. The object storage speaks the S3 API. Sync ships in the box. None of it is proprietary, and all of it is portable. This post walks the data layer and the one test that matters: can you leave?

## Standard Postgres, not a proprietary database

RevealUI runs on Postgres. Specifically NeonDB, which is Postgres, the real thing, with the standard wire protocol and `pg_dump` that does exactly what you expect. The schema is 96 tables defined with Drizzle ORM, typed end to end, and it is not hiding any vendor-only behavior in the hot path.

That choice has a few consequences worth naming:

- Your queries are SQL. They run on Neon today and on any other Postgres tomorrow, managed or self-hosted, without a rewrite.
- Your data is a `pg_dump` away from being somewhere else. There is no export API to beg for and no proprietary format to reverse-engineer.
- The schema is in your repo, in TypeScript, versioned with migrations. You can read it, diff it, and own it.

New features are built to stay portable on purpose: the project is mid-migration off an earlier Supabase dependency, and the rule for new code is that it must not depend on any one provider's Postgres extensions. Standard first.

## Object storage you can move

Files, images, and uploads go to Cloudflare R2, which is S3-compatible. That hyphenated word is the whole point. R2 is the canonical backend (the older Vercel Blob integration is legacy and being retired), but the code talks to it through the S3 API, the same API that AWS S3, MinIO, and a dozen other stores speak.

So the storage layer passes the same test the database does. Point the S3 credentials at a different provider and your application does not notice. Your media is not trapped behind a vendor SDK with no standard under it. It is objects in a bucket, addressable the way object storage has been addressable for fifteen years.

## Real-time sync, in the box

This is the piece most stacks bolt on later, and the one RevealUI ships with: `@revealui/sync`. It is a real-time sync layer that wraps ElectricSQL for syncing Postgres data to clients and Yjs CRDTs for collaborative editing. Out of that you get an offline queue, a shape cache, conflict resolution, and collaborative documents, without standing up a separate real-time service.

The model is worth understanding because it is not websockets-and-hope. ElectricSQL syncs defined "shapes" of your Postgres data to the client and keeps them live, so the client reads from a local copy that stays current. Yjs handles the case where two people edit the same thing at once, merging changes with conflict-free data types instead of last-write-wins. The offline queue means a client that loses its connection keeps working and reconciles when it comes back.

It is the same Postgres from the first section. Sync is a layer over data you already own, not a second source of truth you have to keep in step by hand.

## Rich text is data, not markup

Content in RevealUI is stored as structured Lexical JSON, not as a blob of HTML. That keeps the door open the same way the rest of the stack does. Because the content is data, it renders on the server without a browser, it can be queried and transformed, and it is not married to one front end. The server-side renderer also sanitizes every URL before it emits anything, so stored content cannot smuggle a `javascript:` link into a page.

Structured content is portable content. You can move it, re-render it somewhere else, or feed it to something that is not a browser at all, which matters more every month that agents read your data instead of people.

## The portability test

Here is the test I apply to any stack I am asked to trust: if I wanted to leave, what would it take? For most "modern" stacks the honest answer is a rewrite, a data-export project, and a few weeks of praying the proprietary features have equivalents.

For this one the answer is `pg_dump`, an S3 bucket copy, and standard protocols on both ends. That is not an accident or a side effect. It is the design goal. Portability is not a feature you add later; it is a property you either build in from the schema up or you do not have at all.

## The trade-off

The honest cost: you are running a Postgres database and an object store, not a single magic box that hides both behind one bill and one dashboard. There is a little more surface area than an all-in-one platform, and you are responsible for the credentials to each piece (RevealUI keeps those in an encrypted local vault rather than scattered across `.env` files, which helps).

What you get back is the thing the all-in-one platforms cannot sell you: the ability to walk away. Standard Postgres, S3-compatible storage, sync built on open protocols, content stored as data. Every layer is one you could re-host yourself. For software you intend to run for years, that is the trade worth making.

Build your business, not your boilerplate.

---

*RevealUI is the open runtime for businesses that run their own AI. The data layer is MIT licensed and ships with every install. Get started with `npx create-revealui`, or read the [docs](https://docs.revealui.com).*
