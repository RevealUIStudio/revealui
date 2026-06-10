---
"@revealui/cli": minor
---

`create-revealui` now writes `.env.development.local` via the previously orphaned `generateEnvFile` generator instead of an inline duplicate that wrote `.env.local`. The generated file gains the admin bootstrap variables, a local Postgres default when the database prompt is skipped, and uncommented Stripe test placeholders mirroring the template `.env.example` shape. Next.js also loads `.env.local` in production, so the dev-only filename keeps generated secrets and placeholders out of production runtimes. Template `.env.example` headers, template UI copy, the generated project README, and the post-create summary all reference the same filename now.
