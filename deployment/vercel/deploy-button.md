# README snippet for GitHub twins

Paste the block for the matching twin into that repo's README. Replace
`TEMPLATE_ID` with `basic-blog`, `e-commerce`, `portfolio`, or `starter`.

Do not add a `vercel.com/templates/...` listing URL. That listing is not live.

```markdown
## Deploy to Vercel

This is the runtime deploy path: your Vercel account and your Neon or Postgres. It is not a Studio SKU and not a Starter Kit.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RevealUIStudio/revealui-template-TEMPLATE_ID&project-name=revealui-TEMPLATE_ID&repository-name=revealui-TEMPLATE_ID&env=POSTGRES_URL,REVEALUI_SECRET,REVEALUI_PUBLIC_SERVER_URL,NEXT_PUBLIC_SERVER_URL&envDescription=Your+Postgres+URL+%28Neon+or+any+Postgres%29+and+RevealUI+runtime+secrets.+This+is+your+Vercel+project+and+your+database.)

Required env: `POSTGRES_URL`, `REVEALUI_SECRET`, `REVEALUI_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_SERVER_URL`. After the first deploy, set the two public URL vars to the Vercel URL and redeploy.

Copy `vercel.json` from `packages/cli/templates/TEMPLATE_ID/vercel.json` in the RevealUI monorepo when you refresh this twin.
```
