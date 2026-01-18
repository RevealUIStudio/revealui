# Documentation Lifecycle Management

**Last Updated**: 2026-01-27  
**Status**: ✅ **Active Policy**  
**Purpose**: Autonomous documentation maintenance and quality control

---

## Overview

This document establishes an autonomous documentation lifecycle management system for the RevealUI Framework. It defines policies, processes, and automation for maintaining documentation quality, preventing bloat, and ensuring accuracy.

### Goals

1. **Prevent Documentation Bloat** - Automatic detection and archiving of outdated files
2. **Maintain Quality** - Regular review cycles and quality checks
3. **Ensure Accuracy** - Automated detection of stale or outdated content
4. **Single Sources of Truth** - Prevent duplicate/conflicting documentation
5. **Autonomous Operation** - Minimal manual intervention required

---

## Lifecycle Stages

### 1. **Active** 📄

**Status**: Current, actively maintained documentation

**Characteristics**:
- `Last Updated` date within last 90 days
- Referenced in navigation/index files
- No duplicate/superseded versions
- Accurate and current information

**Maintenance**:
- Updated as codebase changes
- Reviewed during regular cycles
- Kept in active documentation directories

**Examples**:
- `README.md`, `STATUS.md`, `PRODUCTION_READINESS.md`
- `docs/guides/QUICK_START.md`
- `docs/development/CI-CD-GUIDE.md`

---

### 2. **Stale** ⚠️

**Status**: Potentially outdated, requires review

**Detection Criteria**:
- `Last Updated` date older than 90 days
- No updates in last 180 days for critical docs
- References to deprecated features
- Broken internal links
- Conflicting information with current docs

**Actions**:
- **Auto-flag** in review reports
- **Manual review** required
- **Update** if still relevant
- **Archive** if superseded
- **Delete** if obsolete

**Automation**:
- Script scans for stale indicators
- Generates review reports
- Flags for human review

---

### 3. **Archived** 📦

**Status**: Historical reference, no longer actively maintained

**Archiving Criteria**:
- Superseded by newer versions
- Completed work no longer relevant
- Duplicate of active documentation
- Outdated status reports
- Historical assessments integrated into main docs

**Location**: `docs/archive/`

**Retention Policy**:
- Keep for 6-12 months minimum
- Delete after 12 months if truly obsolete
- Keep permanently if historical value

**Automation**:
- Move to archive automatically
- Update references when archiving
- Quarterly review for deletion

---

### 4. **Deleted** 🗑️

**Status**: Removed from codebase

**Deletion Criteria**:
- Truly obsolete (no historical value)
- Duplicate of active documentation
- Archived for 12+ months
- Empty/placeholder files
- Temporary assessment files after integration

**Before Deletion**:
- Verify no references in active docs
- Extract any critical information
- Update navigation/index files
- Document deletion in CHANGELOG if significant

---

## Automated Workflows

### Workflow 1: Stale Documentation Detection

**Frequency**: Weekly (automated)

**Process**:
1. Scan all markdown files for:
   - `Last Updated` dates older than 90 days
   - No updates in last 180 days (critical docs)
   - Assessment files older than 30 days
   - Status files superseded by STATUS.md
2. Generate report: `docs/reports/stale-docs-report.md`
3. Flag for review in tracking system

**Script**: `scripts/docs/detect-stale-docs.ts`

**Output**: List of files requiring review, prioritized by age and importance

---

### Workflow 2: Assessment File Management

**Frequency**: After each major milestone (automated trigger)

**Process**:
1. Detect new assessment files in `packages/*/` or `docs/assessments/`
2. Check if assessment is integrated into main docs (STATUS.md, PRODUCTION_READINESS.md)
3. If integrated → Archive immediately
4. If not integrated → Flag for review (30-day grace period)
5. After 30 days → Auto-archive if not reviewed

**Rules**:
- Only ONE assessment per package allowed
- Assessment must be integrated or archived within 30 days
- No assessment files in `packages/*/` directories (only README.md)

**Script**: `scripts/docs/manage-assessments.ts`

---

### Workflow 3: Duplicate Detection

**Frequency**: Monthly (automated)

**Process**:
1. Scan for duplicate content:
   - Multiple status documents
   - Similar assessment files
   - Duplicate guides/references
2. Compare with current sources of truth:
   - `docs/STATUS.md` vs other status docs
   - `docs/PRODUCTION_READINESS.md` vs other assessments
3. Flag duplicates for consolidation/archival
4. Update references if needed

**Script**: `scripts/docs/detect-duplicates.ts`

**Output**: List of potential duplicates, recommendations for consolidation

---

### Workflow 4: Reference Validation

**Frequency**: Weekly (automated)

**Process**:
1. Scan all markdown files for internal links
2. Validate link targets exist
3. Check for broken references
4. Detect references to archived/deleted files
5. Update references automatically when possible

**Script**: `scripts/docs/validate-references.ts`

**Output**: List of broken references, suggested fixes

---

### Workflow 5: Documentation Accuracy Validation

**Frequency**: Weekly (automated)

**Process**:
1. Validate code examples are syntactically valid
2. Verify file paths and references exist
3. Check package imports/exports are correct
4. Validate commands match package.json scripts
5. Verify internal links are valid
6. Check for deprecated patterns (require, old packages, npm/yarn)
7. Generate accuracy report with errors and warnings

**Script**: `scripts/docs/validate-documentation-accuracy.ts`

**Checks**:
- ✅ Code block syntax (ESM vs CommonJS)
- ✅ Import paths and package references
- ✅ File paths (existence validation)
- ✅ Commands (tool validation: pnpm vs npm/yarn)
- ✅ Internal links (file existence)
- ✅ Deprecated patterns detection

**Output**: `docs/reports/accuracy-report.md`

**Exit Code**: 1 if errors found (CI/CD ready)

---

### Workflow 6: Quarterly Archive Review

**Frequency**: Quarterly (automated + manual review)

**Process**:
1. Review all files in `docs/archive/`
2. Check last access/update dates
3. Identify files safe to delete (12+ months old, no references)
4. Generate deletion recommendations
5. Manual approval before deletion

**Script**: `scripts/docs/review-archive.ts`

**Output**: List of files recommended for deletion, impact analysis

---

## Configuration

### Lifecycle Configuration File

**Location**: `docs-lifecycle.config.json`

```json
{
  "staleThresholds": {
    "active": 90,
    "critical": 180,
    "assessments": 30
  },
  "archiveRetention": {
    "minimum": 180,
    "default": 365,
    "permanent": []
  },
  "autoArchive": {
    "assessments": true,
    "statusFiles": true,
    "completionFiles": true
  },
  "excludeFromStaleCheck": [
    "docs/archive/**",
    "LICENSE.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md"
  ],
  "sourcesOfTruth": [
    "docs/STATUS.md",
    "docs/PRODUCTION_READINESS.md",
    "docs/PRODUCTION_ROADMAP.md",
    "README.md"
  ],
  "reviewSchedule": {
    "weekly": ["stale-detection", "reference-validation"],
    "monthly": ["duplicate-detection"],
    "quarterly": ["archive-review"]
  }
}
```

---

## Automation Scripts

### 1. `scripts/docs/detect-stale-docs.ts`

Detects and reports stale documentation.

**Usage**:
```bash
pnpm docs:check:stale
```

**Output**: `docs/reports/stale-docs-report.md`

---

### 2. `scripts/docs/manage-assessments.ts`

Manages assessment files - archives after integration.

**Usage**:
```bash
pnpm docs:manage:assessments
```

**Triggers**: 
- After major milestones
- Before releases
- Weekly scan

---

### 3. `scripts/docs/detect-duplicates.ts`

Detects duplicate or redundant documentation.

**Usage**:
```bash
pnpm docs:check:duplicates
```

**Output**: `docs/reports/duplicates-report.md`

---

### 4. `scripts/docs/validate-references.ts`

Validates internal links and references.

**Usage**:
```bash
pnpm docs:check:references
```

**Output**: `docs/reports/broken-references.md`

---

### 5. `scripts/docs/validate-documentation-accuracy.ts` ✅

Comprehensive documentation accuracy validation.

**Usage**:
```bash
pnpm docs:validate:accuracy
```

**Features**:
- Code block syntax validation
- Import/package reference validation
- File path validation
- Command validation (pnpm vs npm/yarn)
- Link validation
- Deprecated pattern detection

**Output**: `docs/reports/accuracy-report.md`

---

### 6. `scripts/docs/review-archive.ts`

Reviews archive for files safe to delete.

**Usage**:
```bash
pnpm docs:review:archive
```

**Output**: `docs/reports/archive-review.md`

---

## CI/CD Integration

### Pre-commit Hooks

**Hook**: Check for new assessment files

**Action**: Warn if assessment file created without archiving plan

**Script**: `.husky/pre-commit-docs`

---

### Weekly CI Jobs

**Schedule**: Every Monday

**Jobs**:
1. Stale documentation detection
2. Reference validation
3. Duplicate detection (monthly)
4. Generate reports

**Workflow**: `.github/workflows/docs-lifecycle.yml`

---

### Quarterly Reviews

**Schedule**: First Monday of quarter

**Process**:
1. Archive review
2. Comprehensive stale check
3. Update lifecycle configuration if needed
4. Document changes

---

## Manual Review Process

### When Manual Review is Required

1. **Stale Files Detected**
   - Review flagged files
   - Decide: Update, Archive, or Delete
   - Update references

2. **New Assessment Files**
   - Integrate into main docs
   - Archive within 30 days
   - Update navigation

3. **Duplicates Found**
   - Choose source of truth
   - Consolidate or archive duplicates
   - Update all references

4. **Archive Review**
   - Approve deletion recommendations
   - Keep files with historical value
   - Update retention policy if needed

---

## Metrics and Monitoring

### Key Metrics

1. **Documentation Freshness**
   - Average age of active documentation
   - Percentage of stale files
   - Oldest active document

2. **Bloat Prevention**
   - Number of assessment files
   - Archive size and growth
   - Duplicate count

3. **Quality Indicators**
   - Broken reference count
   - Missing "Last Updated" dates
   - Stale status files

### Dashboard

**Location**: `docs/reports/dashboard.md`

**Updated**: Weekly

**Metrics**:
- Total markdown files
- Active vs archived ratio
- Stale files count
- Broken references count
- Last review date

---

## Best Practices

### Creating New Documentation

1. **Before Creating**:
   - Check if topic already documented
   - Verify not duplicating existing docs
   - Choose appropriate location

2. **When Creating**:
   - Include `Last Updated` date
   - Link from appropriate index/navigation
   - Use consistent format
   - Reference current sources of truth

3. **After Creating**:
   - Update navigation/index files
   - Verify links work
   - Set appropriate category

### Updating Documentation

1. **Always**:
   - Update `Last Updated` date
   - Verify accuracy of changes
   - Check for broken references
   - Update related documentation

2. **When Superseding**:
   - Archive old version immediately
   - Update all references
   - Update navigation
   - Document in CHANGELOG if significant

### Archiving Documentation

1. **Before Archiving**:
   - Verify superseded by current docs
   - Extract critical information if needed
   - Update all references
   - Document reason for archiving

2. **During Archiving**:
   - Move to `docs/archive/`
   - Add archive date to file header
   - Update references in navigation
   - Generate archive report

---

## Success Criteria

### Phase 1: Foundation (Complete)

- ✅ Lifecycle policy established
- ✅ Configuration file created
- ✅ Core automation scripts created
- ✅ CI/CD integration planned

### Phase 2: Implementation (Next)

- [ ] Automation scripts implemented
- [ ] CI/CD workflows configured
- [ ] Initial baseline established
- [ ] Weekly reports generating

### Phase 3: Optimization (Future)

- [ ] Fully autonomous operation
- [ ] < 5% stale documentation
- [ ] Zero broken references
- [ ] Automated archive cleanup

---

## Maintenance Schedule

### Daily (Automated)
- Reference validation
- Broken link detection

### Weekly (Automated + Report)
- Stale documentation detection
- Assessment file management
- Generate dashboard

### Monthly (Automated + Review)
- Duplicate detection
- Comprehensive report
- Manual review of flags

### Quarterly (Automated + Manual)
- Archive review
- Lifecycle policy review
- Metrics analysis
- Process improvements

---

## Integration Points

### Existing Tools

1. **Documentation Lifecycle Manager** (`docs-lifecycle.config.json`)
   - Extend for autonomous workflows
   - Add stale detection rules
   - Configure auto-archive triggers

2. **Git Hooks** (`.husky/`)
   - Pre-commit checks
   - Assessment file warnings
   - Reference validation

3. **CI/CD Workflows** (`.github/workflows/`)
   - Weekly lifecycle jobs
   - Report generation
   - Automated notifications

---

## Future Enhancements

1. **AI-Powered Content Analysis**
   - Detect outdated information automatically
   - Suggest improvements
   - Identify gaps

2. **Automatic Updates**
   - Sync with codebase changes
   - Update examples automatically
   - Refresh outdated code snippets

3. **Smart Archiving**
   - Machine learning for relevance scoring
   - Predictive archiving
   - Intelligent retention policies

---

## Conclusion

This lifecycle management system provides:

✅ **Automated Detection** - Finds stale/duplicate docs automatically  
✅ **Clear Policies** - Defined stages and criteria  
✅ **Regular Reviews** - Scheduled maintenance cycles  
✅ **Quality Control** - Maintains documentation standards  
✅ **Scalability** - Grows with the project  

**Next Steps**: Implement automation scripts and CI/CD integration for fully autonomous operation.

---

**Last Updated**: 2026-01-27  
**Status**: ✅ Policy Established | ⏭️ Implementation Next