# Owner launch checklist (GAP-434)

Agent-prepared. Run from a real shell. Polar credentials and M-11 escape
hatch are disposition-shaped.

## Status (2026-08-02)

| Item | State |
|------|--------|
| Kit content (npm, Postgres-only) | on revealui `test` / `examples/starter-kit` (#2245) |
| Standalone CI | `.github/workflows/starter-kit-standalone.yml` in monorepo |
| Marketing listing | revealui#2358 (`/pricing#starter-kit`) |
| Private repo `RevealUIStudio/revealui-starter-kit` | **empty** (created, never seeded) |
| Polar product $299 | not live |
| Stripe first-month-Pro coupon | not seeded |
| `SITE.urls.starterKitCheckout` | empty until Polar URL exists |

## 1. Seed the private buyer repo (one-time)

The private repo must receive the kit as its **root** (not nested under
`examples/`). After #2245 the kit is npm-resolvable; buyers never need the
monorepo.

```bash
# From any machine with fleet git identity + SSH:
SOURCE="$HOME/revfleet/revealui"   # or a clean worktree on origin/test
git -C "$SOURCE" fetch origin test
git -C "$SOURCE" switch --detach origin/test

SEED="$HOME/tmp/revealui-starter-kit-seed"
rm -rf "$SEED"
bash "$SOURCE/examples/starter-kit/scripts/assemble-private-seed.sh" \
  --source "$SOURCE/examples/starter-kit" \
  --out "$SEED"

cd "$SEED"
git init -b main
git add .
git -c user.name="RevealUI Studio" \
    -c user.email="43050008+joshua-v-dev@users.noreply.github.com" \
    commit -S -m "chore: seed RevealUI Starter Kit (GAP-434)"

git remote add origin git@github.com-revealui:RevealUIStudio/revealui-starter-kit.git

# Empty remote has no PR base — one authorized direct push to main:
git config revealui.hooks.no-protection true
git push -u origin main
git config --unset revealui.hooks.no-protection
```

Verify: `gh api repos/RevealUIStudio/revealui-starter-kit/commits --jq '.[0].sha'`

## 2. Branch protection (after seed has a commit)

In GitHub UI or `gh api` (repo settings mutation, owner-only):

- Require signed commits
- Require status checks when CI exists on that repo
- No force-push to `main`

## 3. Polar product ($299)

1. Create/open Polar org for RevealUI Studio.
2. Product: **RevealUI Starter Kit**, one-time **$299**.
3. Benefits: license key (or download token) + **private GitHub repo access**
   to `RevealUIStudio/revealui-starter-kit`.
4. Copy the public checkout URL.
5. In revealui (follow-up PR or same day):

```ts
// apps/marketing/app/content/site.ts
starterKitCheckout: 'https://polar.sh/...',  // paste Polar product URL
```

Marketing CTA flips from email-reserve to **Buy on Polar** automatically.

## 4. Stripe first-month-of-Pro coupon

Not a catalog product. Create once in Stripe live (or test, then live):

- Duration: once / 1 month
- Percent or amount: 100% of first Pro month
- Name: e.g. `starter_kit_pro_month_1`
- Deliver code (or auto-apply token) with Polar purchase confirmation /
  Substack invite email.

Optional later: wire env `REVEALUI_STARTER_KIT_PRO_COUPON` if checkout should
auto-apply; not required for first sale.

## 5. Manual Substack invite

At launch volume: each buyer gets a private Substack section invite by hand
(owner ruling 2026-07-26). Automate only when volume justifies it.

## 6. Acceptance test

1. Real Polar checkout (owner card OK; refund after).
2. Repo access lands.
3. Fresh clone of private repo (no monorepo above it):
   `pnpm install && pnpm test && pnpm recipe:action`
4. Optional: `bash scripts/bootstrap.sh` if Postgres recipes are in scope.
5. Marketing: `/pricing#starter-kit` primary CTA is Polar URL.
6. Record listing URL + test purchase evidence on GAP-434 and close.

## Do not

- Claim Polar checkout live before step 3.
- Ship monorepo-only docker build paths as the buyer path (retired by #2245).
- Put secrets in the private seed; buyers run `generate-secrets` / bootstrap.
