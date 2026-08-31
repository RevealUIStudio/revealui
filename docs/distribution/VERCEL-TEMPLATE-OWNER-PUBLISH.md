# Owner publish leftover — Vercel one-click listing

Agent work in this repository is the buyer Deploy to Vercel path:

- Listing metadata: [`deployment/vercel/template.json`](../../deployment/vercel/template.json)
- Project config: [`deployment/vercel/vercel.json`](../../deployment/vercel/vercel.json)
- Scaffold copy: [`packages/cli/templates/starter/vercel.json`](../../packages/cli/templates/starter/vercel.json)
- Public copy: `/templates` on revealui.com
- Clone source: existing GitHub twin `RevealUIStudio/revealui-template-starter`

This leftover is **owner dashboard** work. Do not invent a live listing URL.

## 1. Sync the GitHub twin

`revealui-template-starter` is a separate repo. After this PR lands on `test`:

1. Copy `packages/cli/templates/starter/vercel.json` into the twin root.
2. Add the official Deploy with Vercel button to the twin README, pointing at
   the clone URL built from `deployment/vercel/template.json`.
3. Keep the twin a blank-canvas starter. Do not turn it into the Starter
   Kit or a studio invoice.

## 2. Vercel Marketplace / templates catalog

As of 2026-07-21 Vercel is not accepting new community template submissions
([Deploy Button docs](https://vercel.com/docs/deploy-button); community
guidance: add the Deploy Button, do not claim a catalog slot).

If Vercel reopens submissions or Studio enrolls as a partner:

1. Sign in on the Vercel team dashboard as owner.
2. Submit the starter twin with the metadata in `template.json`.
3. Icon: use
   [`packages/presentation/src/assets/brand/revealui-logo.svg`](../../packages/presentation/src/assets/brand/revealui-logo.svg)
   — navy Circuit-R, empty bowl, origin
   `translate(256,256) scale(1.06) translate(-300,-320)`. No white plate. No redraw.
   Do not upload `icon-mark.svg` (rounded plate) as the listing mark.
4. Record the public listing URL only after Vercel publishes it.
5. Until then, the honest path is the Deploy Button on `/templates` and the
   twin README.

## 3. Do not

- Publish a fake `vercel.com/templates/...` URL.
- Call this managed hosting, SSO shipped, or a live-or-holdback catalog.
- Sell RevDev, RevForge, RevKit, or Fleet as this template.
- Present this as the Starter Kit.
- Add a fourth studio invoice. Studio SKUs stay Hour $300 / Architecture
  artifact bundle and review $3,500 / Launch $7,500.
- Finish Railway GAP-430 in the same change. Vercel is the chosen one-click.

## 4. Acceptance for this leftover

1. Twin has `vercel.json` and a working Deploy Button.
2. Owner dashboard publish completed **or** explicitly deferred with the
   current Vercel "not accepting submissions" note.
3. No invented listing URL on marketing or docs.
