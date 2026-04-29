# Gitleaks baseline maintenance

The weekly Gitleaks scan (`Security` workflow → `gitleaks` job, cron Mon 09:00 UTC) walks full git history (`fetch-depth: 0`). Without a baseline, every historical finding from a long-since-rotated key reappears every Monday → alert fatigue → real new leaks get missed in the wash.

The baseline at `.gitleaks.baseline.json` (repo root) captures fingerprints of historical leaks that have been **rotated and accepted as residual git-history noise**. The CI passes `--baseline-path .gitleaks.baseline.json` to the gitleaks CLI; baseline entries are suppressed, new findings still fail the job.

## When to refresh the baseline

You **must** regenerate the baseline after:

1. **You rotated a credential AND the historical leak fingerprint was previously in the baseline.** The rotation does not remove the historical commit; the baseline already knows about it. No action needed unless the rotation introduced a *new* historical leak (rare).
2. **A new historical leak was discovered AND has been rotated.** Add it to the baseline so the weekly scan stops flagging it. Rotation is the prerequisite — never baseline an active leak.
3. **`git filter-repo` / `bfg-repo-cleaner` rewrote history.** Commit hashes changed; baseline fingerprints are stale. Regenerate.

You **must NOT** refresh the baseline:

- To silence a *new* finding without rotating the leaked credential. **Rotate first.** Baseline is for accepted residual noise, not active risk.
- To silence a finding in the working tree. Use `.gitleaksignore` (per-finding) or the `[allowlist]` block in `.gitleaks.toml` (path-based) instead.

## How to refresh

```bash
cd ~/suite/revealui

# Regenerate against current history with redaction
gitleaks detect \
  --report-path .gitleaks.baseline.json \
  --report-format json \
  --redact \
  --no-banner

# Verify the baseline suppresses the findings cleanly
gitleaks detect \
  --no-banner \
  --redact \
  --config .gitleaks.toml \
  --baseline-path .gitleaks.baseline.json
# Expected: "no leaks found", exit 0
```

`--redact` replaces the leaked secret value with `REDACTED` in the JSON. Baseline matching uses fingerprints (commit + file + rule + line), not secret values, so redaction is safe and prevents the baseline file itself from re-leaking the rotated values.

## How to verify the gate still catches new leaks

After any baseline change, prove detection still works on a throwaway branch:

```bash
git checkout -b chore/gitleaks-smoke

# Add a synthetic test secret with an obvious sentinel
echo 'const fake = "sk_live_LEAKED_TEST_VALUE_DELETE_ME_BEFORE_PUSH"' \
  > /tmp/leak-test.ts
git add /tmp/leak-test.ts && git commit -m 'test: gitleaks smoke (DELETE ME)'

# Run the same command CI uses
gitleaks detect --no-banner --redact \
  --config .gitleaks.toml \
  --baseline-path .gitleaks.baseline.json
# Expected: leaks found: 1, exit non-zero

# Clean up — never push the smoke commit
git reset --hard HEAD~1
git checkout test
git branch -D chore/gitleaks-smoke
```

## Baseline file format

Each entry in `.gitleaks.baseline.json` is a Gitleaks finding object with `RuleID`, `File`, `Commit`, `Date`, `Author`, `Match` (redacted), `Fingerprint`, line/column metadata. The CI's `gitleaks detect --baseline-path` does a fingerprint-equality check against the report it would otherwise emit; matching entries are dropped.

Do **not** hand-edit the baseline file. If you need to re-include a baselined finding (e.g. it was supposed to be addressed but wasn't), regenerate from a clean run after addressing the underlying issue.

## Cadence

There is no scheduled cadence. Refresh on demand when one of the trigger conditions above occurs. The historical leak surface stays small over time (rotated credentials don't grow unless we leak new ones), so the baseline file should remain a handful of entries.

If the baseline ever grows past ~50 entries, audit before adding more — that's a signal the team is shipping leaks faster than rotating them.

## Cross-references

- Workflow: `.github/workflows/security.yml` (`gitleaks` job)
- Allowlist (paths/patterns): `.gitleaks.toml` `[allowlist]`
- Per-finding allowlist: `.gitleaksignore`
- Rotation prerequisite: rotate the leaked credential **before** baselining (rotation procedures are in the private `~/suite/.jv/scripts/rotation/` toolkit; follow whichever script matches the credential class)
