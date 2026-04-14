---
title: Backup Restore Verification Procedure
description: Quarterly restore drill procedures, RTO/RPO targets, and verification checklists for all RevealUI data stores. Supports SOC2 compliance (CC6.1, CC7.5, A1.2, A1.3).
last-updated: 2026-04-12
status: active
---

# Backup Restore Verification Procedure

## 1. Purpose

This document defines the backup inventory, restore drill procedures, and verification criteria for all RevealUI data stores. It ensures that backups are functional, recovery objectives are achievable, and audit evidence is collected for SOC2 compliance (specifically CC6.1, CC7.5, A1.2, and A1.3).

Restore drills are conducted quarterly. Each drill validates at least one data store end to end, with a full rotation across all stores every 12 months.

## 2. Backup Inventory

### 2.1 Data Stores

| Data Store | Backup Method | Frequency | Retention | Location | Owner |
|------------|--------------|-----------|-----------|----------|-------|
| **NeonDB (primary database)** | Managed point-in-time recovery (PITR) | Continuous (WAL streaming) | 7 days (Free), 30 days (Pro) | Neon cloud, same region | Neon (managed) |
| **NeonDB branch snapshots** | On-demand branch creation | Before each migration, weekly | 30 days or manual cleanup | Neon cloud | RevealUI Studio |
| **Supabase (secondary database)** | Managed daily backups + PITR (Pro) | Daily automatic, continuous PITR | 7 days (Pro) | Supabase cloud, same region | Supabase (managed) |
| **Source code** | Git (distributed VCS) | Every push | Indefinite (full history) | GitHub (primary), LTS drive (mirror) | RevealUI Studio |
| **Secrets and credentials** | RevVault (encrypted Rust CLI store) | On every secret change | Indefinite (versioned) | Local encrypted store, LTS backup | RevealUI Studio |
| **npm packages** | Published to npm registry | Every release | Indefinite (immutable once published) | npm registry | RevealUI Studio |
| **Vercel deployments** | Immutable deployment artifacts | Every deploy | 30 days (preview), indefinite (production) | Vercel cloud | Vercel (managed) |
| **CI/CD configuration** | Git-tracked (`.github/workflows/`) | Every push | Indefinite (full history) | GitHub | RevealUI Studio |
| **LTS drive mirror** | rsync from WSL | Weekly (manual, `pnpm sync-lts`) | 3 most recent snapshots | External drive mounted at `$LTS_ROOT` | RevealUI Studio |

### 2.2 What Is Not Backed Up

These items are excluded by design, with justification:

| Item | Reason |
|------|--------|
| **Vercel build cache** | Regenerated on each deployment. No data loss impact. |
| **Local node_modules** | Deterministically reproducible from lockfile (`pnpm install --frozen-lockfile`). |
| **Development databases (PGlite)** | Ephemeral, in-memory. Seeded from `pnpm db:seed`. |
| **Browser caches** | Client-side only. Cleared on new deployments. |

## 3. Recovery Objectives

| Data Store | RTO (Recovery Time) | RPO (Recovery Point) | Notes |
|------------|--------------------|-----------------------|-------|
| **NeonDB** | 15 minutes | < 1 minute (PITR) | Branch restore is near-instant. Full PITR depends on WAL position. |
| **Supabase** | 30 minutes | 24 hours (daily backup) or < 1 minute (PITR on Pro) | Daily backups are automatic. PITR requires Pro plan. |
| **Source code (GitHub)** | 5 minutes | 0 (last push) | Clone from GitHub or LTS mirror. Branch protection prevents force-push. |
| **Secrets (RevVault)** | 15 minutes | Last export (manual trigger) | Decrypt from LTS backup if local store is lost. |
| **npm packages** | 0 (already published) | 0 (immutable) | Published packages are immutable. Rebuild from source if registry is unavailable. |
| **Vercel deployments** | 2 minutes | 0 (immutable) | Instant rollback to any previous production deployment via Vercel dashboard. |
| **LTS drive mirror** | 30 minutes | 1 week (sync frequency) | Attach drive, verify checksums, clone or copy as needed. |

## 4. Quarterly Restore Drill Procedure

Each quarter, test at least one data store from the rotation schedule below. Over four quarters, all stores must be tested at least once.

**Path conventions used below:** `$LTS_ROOT` is the operator's LTS mirror mount (set in your environment; the reference operator uses `/mnt/e`). Substitute your own mount point throughout.

### 4.1 Rotation Schedule

| Quarter | Primary Drill Target | Secondary Drill Target |
|---------|---------------------|----------------------|
| Q1 (Jan) | NeonDB PITR restore | Source code (GitHub clone) |
| Q2 (Apr) | Supabase restore | Secrets (RevVault decrypt) |
| Q3 (Jul) | NeonDB branch restore | Vercel deployment rollback |
| Q4 (Oct) | Full disaster recovery (all stores) | LTS drive restore |

### 4.2 NeonDB Point-in-Time Recovery Drill

**Objective**: Verify that production data can be restored to a specific point in time.

**Prerequisites**:
- Neon console access with project admin permissions
- A known-good timestamp to restore to (record before starting)
- Read access to the production database for row-count comparison

**Steps**:

1. Record the current state of the production database:
   ```bash
   # Connect to production and capture row counts for key tables
   psql "$NEON_DATABASE_URL" -c "
     SELECT 'users' as table_name, count(*) FROM users
     UNION ALL SELECT 'sites', count(*) FROM sites
     UNION ALL SELECT 'content', count(*) FROM content
     UNION ALL SELECT 'sessions', count(*) FROM sessions;
   "
   ```
   Save this output as the baseline.

2. Note the current timestamp (UTC) as the target restore point:
   ```bash
   date -u +"%Y-%m-%dT%H:%M:%SZ"
   ```

3. Create a PITR branch in Neon:
   - Open the Neon console, navigate to the project.
   - Select **Branches**, then **Create Branch**.
   - Choose **Point in time** and enter the recorded timestamp.
   - Name the branch `drill-pitr-YYYY-MM-DD`.

4. Connect to the restored branch and verify data:
   ```bash
   psql "$DRILL_BRANCH_URL" -c "
     SELECT 'users' as table_name, count(*) FROM users
     UNION ALL SELECT 'sites', count(*) FROM sites
     UNION ALL SELECT 'content', count(*) FROM content
     UNION ALL SELECT 'sessions', count(*) FROM sessions;
   "
   ```

5. Compare row counts against the baseline. They should match exactly (or reflect only changes made after the restore point).

6. Run a sample application query to verify data integrity:
   ```bash
   psql "$DRILL_BRANCH_URL" -c "
     SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5;
   "
   ```

7. Delete the drill branch after verification:
   - In the Neon console, delete `drill-pitr-YYYY-MM-DD`.

8. Record results in the drill log (Section 6).

### 4.3 NeonDB Branch Restore Drill

**Objective**: Verify that a pre-migration snapshot branch can be used for rollback.

**Steps**:

1. Identify the most recent migration branch (e.g., `pre-migration-YYYY-MM-DD`).

2. Connect to the branch and verify schema version:
   ```bash
   psql "$MIGRATION_BRANCH_URL" -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
   ```

3. Run the application test suite against the branch:
   ```bash
   DATABASE_URL="$MIGRATION_BRANCH_URL" pnpm --filter @revealui/db test
   ```

4. Confirm the schema matches expectations for the migration point.

5. Record results in the drill log (Section 6).

### 4.4 Supabase Restore Drill

**Objective**: Verify that Supabase daily backups or PITR can restore the secondary database.

**Steps**:

1. Record current Supabase state (vector store counts, storage bucket sizes):
   ```bash
   psql "$SUPABASE_DATABASE_URL" -c "
     SELECT schemaname, tablename, n_live_tup
     FROM pg_stat_user_tables
     WHERE schemaname = 'public'
     ORDER BY n_live_tup DESC
     LIMIT 10;
   "
   ```

2. Initiate a restore via the Supabase dashboard:
   - Navigate to **Project Settings > Backups**.
   - Select the most recent daily backup (or a PITR timestamp if on Pro).
   - Restore to a new project (never overwrite production).

3. Connect to the restored project and compare table counts against the baseline.

4. Verify vector data integrity (if applicable):
   ```bash
   psql "$RESTORED_SUPABASE_URL" -c "
     SELECT count(*) FROM documents WHERE embedding IS NOT NULL;
   "
   ```

5. Verify Supabase Auth user count matches expectations.

6. Delete the test project after verification.

7. Record results in the drill log (Section 6).

### 4.5 Source Code Restore Drill

**Objective**: Verify that the repository can be fully reconstructed from GitHub and/or LTS backup.

**Steps**:

1. Clone the repository to a temporary directory:
   ```bash
   mkdir -p /tmp/restore-drill && cd /tmp/restore-drill
   git clone https://github.com/RevealUIStudio/revealui.git
   cd revealui
   ```

2. Verify branch integrity:
   ```bash
   git branch -r | grep -c "origin/"  # Should match expected branch count
   git log --oneline -5 main
   git log --oneline -5 test
   ```

3. Verify the build completes:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```

4. Run the test suite:
   ```bash
   pnpm test
   ```

5. Verify tag and release history:
   ```bash
   git tag --list | tail -10
   ```

6. Clean up:
   ```bash
   rm -rf /tmp/restore-drill
   ```

7. Record results in the drill log (Section 6).

### 4.6 Secrets Restore Drill

**Objective**: Verify that RevVault secrets can be decrypted and used from the LTS backup.

**Steps**:

1. Copy the RevVault backup from LTS to a temporary location:
   ```bash
   cp -r $LTS_ROOT/professional/RevealUI/.revvault /tmp/revvault-drill/
   ```

2. List available secrets (without decrypting):
   ```bash
   revvault list --vault /tmp/revvault-drill/
   ```

3. Verify decryption of a non-production test secret:
   ```bash
   revvault get TEST_DRILL_SECRET --vault /tmp/revvault-drill/
   ```

4. Confirm the decrypted value matches the expected test value.

5. Clean up:
   ```bash
   rm -rf /tmp/revvault-drill/
   ```

6. Record results in the drill log (Section 6).

### 4.7 Vercel Deployment Rollback Drill

**Objective**: Verify that a previous production deployment can be instantly promoted.

**Steps**:

1. Record the current production deployment ID:
   ```bash
   vercel ls --prod --limit 1
   ```

2. Identify the previous production deployment:
   ```bash
   vercel ls --prod --limit 5
   ```

3. Promote the previous deployment to production:
   ```bash
   vercel promote <previous-deployment-url>
   ```

4. Verify the rollback by checking the production URL responds correctly:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" https://revealui.com/api/health
   ```

5. Restore the original deployment:
   ```bash
   vercel promote <original-deployment-url>
   ```

6. Record results in the drill log (Section 6).

### 4.8 LTS Drive Restore Drill

**Objective**: Verify that the LTS drive backup contains a usable copy of the repository.

**Steps**:

1. Verify the LTS drive is mounted and accessible:
   ```bash
   ls $LTS_ROOT/professional/RevealUI/
   ```

2. Check the sync timestamp:
   ```bash
   stat $LTS_ROOT/professional/RevealUI/.git/FETCH_HEAD
   ```

3. Clone from the LTS mirror to a temporary directory:
   ```bash
   git clone $LTS_ROOT/professional/RevealUI /tmp/lts-restore-drill
   cd /tmp/lts-restore-drill
   ```

4. Verify recent commits are present:
   ```bash
   git log --oneline -10
   ```

5. Compare commit hashes with GitHub:
   ```bash
   git ls-remote https://github.com/RevealUIStudio/revealui.git HEAD
   git rev-parse HEAD
   ```
   Note any divergence (expected if LTS sync is not same-day).

6. Clean up:
   ```bash
   rm -rf /tmp/lts-restore-drill
   ```

7. Record results in the drill log (Section 6).

## 5. Post-Restore Verification Checklist

After every restore drill, complete this checklist before marking the drill as passed.

### 5.1 Database Restores (NeonDB, Supabase)

- [ ] Row counts for critical tables match baseline (within expected delta)
- [ ] Schema version matches the target restore point
- [ ] Foreign key constraints are intact (no orphaned records)
- [ ] Application queries return expected results
- [ ] No data from after the restore point is present (PITR accuracy)
- [ ] Restored instance is isolated from production (no cross-contamination)
- [ ] Test data or drill artifacts are cleaned up after verification

### 5.2 Source Code Restores

- [ ] All expected branches are present
- [ ] `pnpm install --frozen-lockfile` succeeds (lockfile integrity)
- [ ] `pnpm build` succeeds across all workspaces
- [ ] `pnpm test` passes (or failures are pre-existing and documented)
- [ ] Git history is complete (tags, merge commits, release history)
- [ ] Branch protection rules are verified on the remote

### 5.3 Secrets Restores

- [ ] RevVault backup can be listed without errors
- [ ] Test secret decrypts to the expected value
- [ ] Backup file integrity matches (checksum comparison if available)
- [ ] No plaintext secrets were written to disk during the drill

### 5.4 Deployment Restores

- [ ] Rollback deployment serves traffic correctly
- [ ] Health check endpoint returns 200
- [ ] Original deployment is restored after the drill
- [ ] No user-facing downtime occurred during the drill

## 6. Drill Record Template

Copy this template for each drill and fill in the results. Store completed records in `docs/security/drill-records/` with the filename format `YYYY-MM-DD-drill-<store>.md`.

```markdown
---
title: Backup Restore Drill Record
date: YYYY-MM-DD
quarter: Q#
conducted-by: Name <email>
---

# Restore Drill Record

## Summary

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Quarter** | Q# YYYY |
| **Conducted by** | Name, email |
| **Data store(s) tested** | (e.g., NeonDB PITR, Source code) |
| **Drill duration** | (e.g., 45 minutes) |
| **Result** | PASS / PARTIAL / FAIL |

## Procedure Followed

Reference the section number from this document (e.g., Section 4.2 for NeonDB PITR).

## Baseline Measurements

(Record pre-drill state: row counts, commit hashes, deployment IDs, etc.)

## Restore Steps Executed

(Document each step performed, including commands run and their output.)

## Post-Restore Verification

(Complete the relevant checklist from Section 5. Note any items that did not pass.)

## Issues Found

| # | Issue | Severity | Resolution | Status |
|---|-------|----------|------------|--------|
| 1 | (description) | Low / Medium / High | (how it was resolved) | Open / Resolved |

## Observations and Recommendations

(Any notes on the process: timing improvements, documentation gaps, tooling needs.)

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Drill conductor | | |
| Reviewer | | |
```

## 7. Escalation Procedure for Failed Restores

If a restore drill fails or a production restore is unsuccessful, follow this escalation path.

### 7.1 Severity Classification

| Severity | Definition | Examples |
|----------|-----------|----------|
| **Low** | Drill inconvenience; data is recoverable through an alternate path. | LTS mirror is stale by 2 weeks. Supabase daily backup is 23 hours old. |
| **Medium** | Primary restore path failed; secondary path is available. | NeonDB PITR branch creation fails; manual export is still possible. RevVault backup decryption fails on LTS copy; local copy is intact. |
| **High** | No verified restore path exists for a critical data store. | NeonDB PITR and branch restores both fail. GitHub repository is inaccessible and LTS mirror is corrupted. |
| **Critical** | Active data loss in production with no working restore. | Production database is corrupted and PITR cannot recover to a clean state. |

### 7.2 Escalation Steps

**For drill failures (non-production):**

1. Document the failure in the drill record (Section 6).
2. Attempt an alternate restore method for the same data store.
3. If the alternate method also fails, escalate to **High** severity.
4. Open a GitHub issue labeled `security` and `backup-failure` with the drill record attached.
5. Schedule a follow-up drill within 2 weeks to verify the fix.

**For production restore failures:**

1. Immediately notify the Security Lead (security@revealui.com).
2. Activate the Incident Response Plan (see `INCIDENT_RESPONSE.md`).
3. Contact the managed service provider directly:
   - **NeonDB**: Support portal at console.neon.tech or support@neon.tech.
   - **Supabase**: Support portal at supabase.com/dashboard or support@supabase.io.
   - **GitHub**: Support portal at support.github.com.
   - **Vercel**: Support portal at vercel.com/support.
4. Document all actions taken, timestamps, and provider responses.
5. After resolution, conduct a post-incident review and update this document with lessons learned.

### 7.3 Communication

| Audience | When to Notify | Method |
|----------|---------------|--------|
| Security Lead | Any High or Critical failure | Email: security@revealui.com |
| Founder | Any Critical failure, or High failure unresolved after 4 hours | Email: founder@revealui.com |
| Affected users | Only if data loss is confirmed | Email notification per Incident Response Plan |
| SOC2 auditor | During next audit cycle, or immediately for Critical failures | Audit evidence package |

## 8. Document Maintenance

This document is reviewed and updated:

- **Quarterly**: After each restore drill, incorporate any procedural changes.
- **On infrastructure change**: When backup providers, retention policies, or recovery tools change.
- **On incident**: After any production restore (successful or failed).

The drill record archive in `docs/security/drill-records/` serves as the audit trail for SOC2 evidence collection.

## 9. Related Documents

- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md)
- [Incident Response Plan](./INCIDENT_RESPONSE.md)
- [SECURITY.md](/SECURITY.md) (vulnerability reporting)
