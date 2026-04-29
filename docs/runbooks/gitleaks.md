# Gitleaks scan (workflow + cutoff)

The weekly Gitleaks scan (`Security` workflow → `gitleaks` job, cron Mon 09:00 UTC) walks git history. Without a cutoff, every historical finding from a long-since-rotated key reappears every Monday → alert fatigue → real new leaks risk being missed in the wash.

The workflow uses `gitleaks detect --log-opts="--since=$GITLEAKS_HISTORY_SINCE"` to skip all commits dated before the cutoff. The cutoff is set to the post-#540 rotation date (2026-04-25). All known historical findings predate the cutoff and have been rotated; new commits past the cutoff still get scanned, so any newly-introduced secret fails the job.

## Why date cutoff (and not `--baseline-path`)

A commit-SHA-based baseline (`gitleaks detect --baseline-path baseline.json`) would suppress findings by `<commit-SHA>:<file>:<rule>:<line>` fingerprint. That fingerprint includes the commit SHA, which **changes whenever the ancestor commit graph is rewritten** — peer rebases, merge trains, force-pushes, history surgery. Each rewrite renders the baseline stale and must be regenerated.

The date cutoff has no SHA dependency. As long as the historical commit's *date* stays before the cutoff (which it always will — git commit dates don't move under rebases), it stays suppressed. The cost: a leak someone intentionally backdates via interactive rebase to a pre-cutoff commit would not be caught by the weekly scheduled scan. That is a narrow attack surface; the working-tree scan (`.gitleaks.toml` `[allowlist]`) still catches active leaks.

## When to bump the cutoff

Raise `GITLEAKS_HISTORY_SINCE` in `.github/workflows/security.yml` after **any major credential rotation** that introduces a transient leak commit. The cutoff makes the rotation commit itself invisible to future scheduled scans, so the per-rotation rotation noise stops repeating every Monday.

Don't bump for routine PRs or doc changes — the cutoff only needs to move when a real-but-rotated secret has just landed in git history.

Don't lower it. The window between the previous cutoff and any newer cutoff is unscanned by scheduled jobs; that's only safe if the leaks in that window have all been rotated.

## Verify the gate still catches new leaks

After any workflow change, prove detection still works on a throwaway branch:

```bash
git checkout -b chore/gitleaks-smoke

# Add a synthetic test secret with an obvious sentinel
cat > /tmp/leak-test.ts <<'EOF'
const fake = "sk_live_LEAKED_TEST_VALUE_DELETE_ME_BEFORE_PUSH"
EOF
git add /tmp/leak-test.ts && git commit -m 'test: gitleaks smoke (DELETE ME)'

# Run the same command CI uses (skip --since to scan working tree too)
gitleaks detect --no-banner --redact --config .gitleaks.toml
# Expected: leaks found: 1, exit non-zero

# Clean up — never push the smoke commit
git reset --hard HEAD~1
git checkout test
git branch -D chore/gitleaks-smoke
```

## How to tell if the workflow regressed

After any change to `.github/workflows/security.yml` `gitleaks` job, watch the next Monday scheduled run output. The healthy pattern is a small commit count + `INF no leaks found` + exit 0:

```
INF 88 commits scanned.
INF scanned ~1.6 MB in 1.5s
INF no leaks found
```

A failure dumps a JSON report as the `gitleaks-report` artifact (uploaded on failure only, 7-day retention) — download from the run page and inspect with `jq`.

## Cross-references

- Workflow: `.github/workflows/security.yml` → `gitleaks` job
- Working-tree allowlist (paths/patterns): `.gitleaks.toml` `[allowlist]`
- Per-finding allowlist: `.gitleaksignore`
- Rotation prerequisite: rotate the leaked credential *before* bumping the cutoff (rotation procedures live in the private `~/suite/.jv/scripts/rotation/` toolkit; follow whichever script matches the credential class)
