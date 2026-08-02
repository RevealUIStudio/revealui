# Owner launch checklist (GAP-434)

Agent-prepared. Polar dashboard, Stripe live coupon, and GitHub org
settings are **owner-only**. Agent cannot merge PRs or create Polar products.

## Status (2026-08-02, post-seed)

| Item | State |
|------|--------|
| Kit content (npm, Postgres-only) | revealui `test` `examples/starter-kit` (#2245) |
| Marketing listing | **MERGED** #2358 — `/pricing#starter-kit` |
| Private seed | **DONE** — `d9b6f2c` on `RevealUIStudio/revealui-starter-kit` |
| Assembler hygiene | monorepo #2361 merged; private drop PR may still be open (#1) |
| Polar product $299 | **not live** (blocker for buy CTA) |
| Stripe first-month-Pro coupon | not seeded |
| `SITE.urls.starterKitCheckout` | `''` until Polar URL exists |
| Branch protection on private `main` | API returns 403 (GitHub free private: rulesets/protection need Pro or public). Rely on fleet M-11 hook on this machine + **stop using no-protection** after seed. |

## 0. Hygiene merges (if still open)

```bash
gh pr merge 1 -R RevealUIStudio/revealui-starter-kit --merge   # drop assembler from buyer tree
# monorepo exclude already on test if #2361 merged
```

## 1. Seed private buyer repo — DONE

Seed commit: `d9b6f2c`. Re-seed only if content drifts; use:

```bash
bash examples/starter-kit/scripts/assemble-private-seed.sh \
  --source examples/starter-kit \
  --out "$HOME/tmp/revealui-starter-kit-seed"
# then PR into main on the private repo (no more direct main push)
```

## 2. Branch protection (best-effort on free private)

GitHub returned: *Upgrade to GitHub Pro or make this repository public* for
rulesets/branch-protection API on this private repo.

Practical options:

1. **Org/GitHub Pro** on the private repo, then enable classic protection:
   Settings → Branches → Protect `main` → require PR, signed commits, no force-push.
2. **Leave free private** and enforce process: never re-enable
   `revealui.hooks.no-protection` for this remote; all changes via PR + review.
3. Do **not** make the kit public until you intentionally open-source it.

## 3. Polar product ($299) — do this next

Docs: [GitHub repository access benefits](https://polar.sh/docs/features/benefits/github-access)

### 3a. Org + GitHub app

1. Sign in at [polar.sh](https://polar.sh) (GitHub login OK).
2. Create or open the **RevealUI Studio** organization (or your studio org slug).
3. Connect GitHub for benefits: install the **Polar GitHub App** on
   `RevealUIStudio` with access to **`revealui-starter-kit`** (private).

### 3b. Benefit

1. Dashboard → **Benefits** → **+ New Benefit**  
   https://polar.sh/dashboard (then Products → Benefits)
2. Type: **GitHub Repository Access**
3. Repository: `RevealUIStudio/revealui-starter-kit`
4. Access: collaborator (read) is enough for clone; lifetime for one-time purchase
5. Save benefit

### 3c. Product

1. **Products** → **+ New Product**
2. Name: `RevealUI Starter Kit`
3. Description (honest): content-only kit (recipes + Postgres bootstrap +
   create-revealui path). Not a Pro subscription. Not a full Fleet stamp.
4. Pricing: **one-time** **$299 USD**
5. Attach benefit: the GitHub repo access benefit from 3b
6. Optional: license key benefit if you want a purchase ID for support mail
7. Publish / enable checkout
8. Copy the **public checkout URL** (product or checkout link from Polar UI)

### 3d. Wire marketing (agent can PR once you paste the URL)

```bash
# Owner: set the URL in a one-line PR, or hand the URL to an agent:
# SITE.urls.starterKitCheckout = 'https://polar.sh/<org>/<product-or-checkout>'
```

In monorepo:

```ts
// apps/marketing/app/content/site.ts
starterKitCheckout: 'https://polar.sh/...',  // paste Polar product/checkout URL
```

`/pricing#starter-kit` CTA becomes **Buy the Starter Kit on Polar**.

## 4. Stripe first-month-of-Pro coupon

Live Stripe (after you confirm mode). Example with Stripe CLI + revvault:

```bash
# Load live secret WITHOUT printing it:
export STRIPE_API_KEY="$(revvault get --full revealui/prod/stripe/secret-key)"

stripe coupons create \
  --duration=once \
  --percent-off=100 \
  --name="Starter Kit first Pro month" \
  --id="starter_kit_pro_month_1"

# Create a promotion code customers can type (or email manually):
stripe promotion_codes create \
  --coupon=starter_kit_pro_month_1 \
  --code=STARTERKITPRO1
```

Deliver code with purchase confirmation / Substack invite. Not auto-wired into
checkout unless you later set an env and product path.

If `revvault` path differs on your machine: `revvault list | grep stripe`.

## 5. Manual Substack invite

At launch volume: invite each buyer to the private Substack section by hand
(owner ruling 2026-07-26).

## 6. Acceptance test

1. Polar checkout with owner card (refund after).
2. GitHub invite to `revealui-starter-kit` lands for the buyer account.
3. Fresh clone (no monorepo parent):

   ```bash
   git clone git@github.com:RevealUIStudio/revealui-starter-kit.git /tmp/kit-smoke
   cd /tmp/kit-smoke
   pnpm install && pnpm test && pnpm recipe:action
   ```

4. Marketing primary CTA is Polar URL (not mailto).
5. Record listing URL + test purchase on GAP-434; close gap.

## Owner paste block (this session)

```bash
# A) Hygiene (if PR still open)
gh pr merge 1 -R RevealUIStudio/revealui-starter-kit --merge

# B) Polar: complete §3 in the Polar dashboard (no CLI in fleet today)

# C) After Polar URL exists — give agent one line, e.g.:
#    "wire starterKitCheckout https://polar.sh/...."
# Or edit site.ts yourself on a branch from origin/test and open a PR.

# D) Coupon (§4) when ready for Pro upsell
```

## Do not

- Claim Polar checkout live before §3 publish.
- Re-enable `revealui.hooks.no-protection` for routine pushes.
- Put secrets in the private seed.
- Invent more homepage marketing copy for the kit before Polar is live.
