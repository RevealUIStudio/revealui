// console-allowed
/**
 * Main claim-drift runner.
 */

import type { CapabilityGateSlice, ClaimGateResult, ClaimGateRunOptions } from '../types.js';
import {
  CLI_TEMPLATE_CLAIM_SPECS,
  countApps,
  countCheckConstraints,
  countCliTemplates,
  countDbTables,
  countDirs,
  countEnforcementTests,
  countMCPServers,
  countPackages,
  countTestFiles,
  countUIComponents,
  countWorkspaces,
  type Metric,
} from './metrics.js';
import {
  buildPackageLicenseMap,
  checkMarketingMetrics,
  countLicenseSplit,
  FLEET_GITHUB_ORG,
  type PackageLicenseMap,
  scanForAspirationalFeatures,
  scanForClaims,
  scanForCopyDependentHolds,
  scanForFleetProductLeaks,
  scanForFutureTenseClaims,
  scanForIncompleteProList,
  scanForLicenseMembershipDrift,
  scanForLicenseSplitAntiPatterns,
  scanForPhantomPackages,
  scanForRvuiTickerLeaks,
} from './scanners.js';
import {
  configureClaimGatesRoot,
  resolvedAspirationalPaths,
  resolvedFutureTenseFiles,
  scanState,
} from './state.js';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Run claim-drift collectors and scanners against a configured root.
 * Capability proof-obligation (GAP-354) is optional and revealui-local for
 * Phase 1 — inject a precomputed CapabilityGateSlice from the monorepo wrapper.
 */
export function runClaimDrift(options: ClaimGateRunOptions): ClaimGateResult {
  configureClaimGatesRoot(options.root, options.profile);
  scanState.showFix = options.showFix === true || (options.argv?.includes('--fix') ?? false);
  scanState.WarnOnly =
    options.warn === true ||
    (options.argv?.includes('--warn') ?? false) ||
    (options.argv?.includes('--baseline') ?? false);
  const capability: CapabilityGateSlice = options.capability ?? {
    scanned: 0,
    proven: 0,
    baselined: [],
    advisories: [],
    violations: [],
  };

  console.log('Claim Drift Detector');
  console.log(`Profile: ${scanState.ActiveProfile.name}`);
  console.log(`scanState.Root:    ${scanState.Root}`);
  console.log('====================\n');

  // Collect actual metrics (product-runtime only)
  const packages = scanState.ActiveProfile.collectMonorepoMetrics ? countPackages() : 0;
  const apps = scanState.ActiveProfile.collectMonorepoMetrics ? countApps() : 0;
  const workspaces = scanState.ActiveProfile.collectMonorepoMetrics ? countWorkspaces() : 0;
  const testFiles = scanState.ActiveProfile.collectMonorepoMetrics ? countTestFiles() : 0;
  const uiComponents = scanState.ActiveProfile.collectMonorepoMetrics ? countUIComponents() : 0;
  const mcpServers = scanState.ActiveProfile.collectMonorepoMetrics ? countMCPServers() : 0;
  const dbTables = scanState.ActiveProfile.collectMonorepoMetrics ? countDbTables() : 0;
  const checkConstraints = scanState.ActiveProfile.collectMonorepoMetrics
    ? countCheckConstraints()
    : 0;
  const cliTemplates = scanState.ActiveProfile.collectMonorepoMetrics ? countCliTemplates() : 0;
  const enforcementTests = scanState.ActiveProfile.collectMonorepoMetrics
    ? countEnforcementTests()
    : 0;
  const licenseSplit = scanState.ActiveProfile.collectMonorepoMetrics
    ? countLicenseSplit()
    : { mit: 0, fsl: 0, internal: 0 };

  if (scanState.ActiveProfile.collectMonorepoMetrics) {
    console.log('Actual metrics:');
    console.log(`  Packages:      ${packages}`);
    console.log(`  Apps:          ${apps}`);
    console.log(`  Workspaces:    ${workspaces} (${packages} + ${apps})`);
    console.log(`  Test files:    ${testFiles}`);
    console.log(`  UI components: ${uiComponents}`);
    console.log(`  MCP servers:   ${mcpServers}`);
    console.log(`  DB tables:     ${dbTables}`);
    console.log(`  CHECKs:        ${checkConstraints}`);
    console.log(`  CLI templates: ${cliTemplates}`);
    console.log(`  Enforcement:   ${enforcementTests}`);
    console.log(
      `  License split: ${licenseSplit.mit} MIT | ${licenseSplit.fsl} FSL-1.1-MIT | ${licenseSplit.internal} internal/none`,
    );
    console.log();
  }

  // GAP-192 PR4 — typed NumericClaimSpec[] (no authored claimPatterns regex).
  const metrics: Metric[] = scanState.ActiveProfile.collectMonorepoMetrics
    ? [
        {
          name: 'packages',
          actual: packages,
          claimSpecs: [
            // "21 packages" or "21 npm packages" but not "14 packages patched"
            // or small counts (<10). Range 10–39 matches the prior (1\d|2\d|3\d).
            {
              metricName: 'packages',
              min: 10,
              max: 39,
              optionalIntervening: ['npm'],
              requiredSequences: [['packages'], ['package']],
              forbidNextWords: ['patched'],
              forbidLabelWords: [
                'oss',
                'mit',
                'dist',
                'workspace',
                'workspaces',
                'internal',
                'pro',
                'fsl',
                'published',
                'private',
                'license',
              ],
            },
          ],
        },
        {
          name: 'apps',
          actual: apps,
          claimSpecs: [
            {
              metricName: 'apps',
              min: 2,
              max: 20,
              requiredSequences: [['apps']],
              labelFirst: true,
              numberFirst: false,
            },
          ],
        },
        {
          name: 'workspaces',
          actual: workspaces,
          claimSpecs: [
            {
              metricName: 'workspaces',
              requiredSequences: [['workspaces'], ['workspace']],
              labelFirst: true,
            },
          ],
        },
        {
          name: 'test files',
          actual: testFiles,
          claimSpecs: [
            // "1,676 test files" — compare step still skips claimed < 100
            {
              metricName: 'test files',
              allowCommas: true,
              requiredSequences: [
                ['test', 'files'],
                ['test', 'file'],
              ],
            },
          ],
        },
        {
          name: 'UI components',
          actual: uiComponents,
          claimSpecs: [
            // Only match total component counts in 50–69, not per-category
            {
              metricName: 'UI components',
              min: 50,
              max: 69,
              optionalIntervening: ['native', 'React', 'UI'],
              requiredSequences: [['components'], ['component']],
            },
            {
              metricName: 'UI components',
              min: 50,
              max: 69,
              requiredSequences: [['components'], ['component']],
              trailingSequences: [['with'], ['built'], ['in', 'the']],
            },
          ],
        },
        {
          name: 'MCP servers',
          actual: mcpServers,
          claimSpecs: [
            {
              metricName: 'MCP servers',
              requiredSequences: [
                ['mcp', 'servers'],
                ['mcp', 'server'],
              ],
            },
          ],
        },
        {
          name: 'DB tables',
          actual: dbTables,
          claimSpecs: [
            // "85 tables", "85 PostgreSQL tables", … — 10..999 plausible totals
            {
              metricName: 'DB tables',
              min: 10,
              max: 999,
              optionalOneOf: ['PostgreSQL', 'database', 'Drizzle', 'primary'],
              requiredSequences: [['tables'], ['table']],
            },
            // "Schema (85 tables)" parenthetical
            {
              metricName: 'DB tables',
              min: 10,
              max: 999,
              parenWrapped: true,
              requiredSequences: [['tables'], ['table']],
            },
          ],
        },
        {
          name: 'CHECK constraints',
          actual: checkConstraints,
          claimSpecs: [
            {
              metricName: 'CHECK constraints',
              min: 10,
              max: 999,
              optionalIntervening: ['drizzle'],
              requiredSequences: [
                ['check', 'constraints'],
                ['check', 'constraint'],
              ],
              labelFirst: true,
            },
          ],
        },
        {
          name: 'CLI templates',
          actual: cliTemplates,
          claimSpecs: CLI_TEMPLATE_CLAIM_SPECS,
        },
        {
          name: 'enforcement tests',
          actual: enforcementTests,
          claimSpecs: [
            {
              metricName: 'enforcement tests',
              requiredSequences: [
                ['enforcement', 'tests'],
                ['enforcement', 'test'],
              ],
            },
          ],
        },
        // License-split metrics — canonical fleet doc shape:
        // "N OSS (MIT)" / "N Pro (FSL...)" / "N internal".
        {
          name: 'MIT packages',
          actual: licenseSplit.mit,
          claimSpecs: [
            { metricName: 'MIT packages', shape: 'oss-mit' },
            {
              metricName: 'MIT packages',
              min: 10,
              max: 39,
              requiredSequences: [
                ['oss', 'packages'],
                ['mit', 'packages'],
              ],
              labelFirst: true,
              numberFirst: false,
            },
          ],
        },
        {
          name: 'FSL packages',
          actual: licenseSplit.fsl,
          claimSpecs: [
            { metricName: 'FSL packages', shape: 'pro-fsl' },
            {
              metricName: 'FSL packages',
              min: 1,
              max: 20,
              requiredSequences: [
                ['pro', 'packages'],
                ['fsl', 'packages'],
              ],
              labelFirst: true,
              numberFirst: false,
            },
          ],
        },
        {
          name: 'internal packages',
          actual: licenseSplit.internal,
          claimSpecs: [
            { metricName: 'internal packages', shape: 'internal-paren' },
            {
              metricName: 'internal packages',
              min: 1,
              max: 10,
              requiredSequences: [
                ['internal', 'packages'],
                ['internal', 'package'],
              ],
              labelFirst: true,
              numberFirst: false,
            },
          ],
        },
      ]
    : [];

  // Scan for claims
  const claims = scanState.ActiveProfile.collectMonorepoMetrics ? scanForClaims(metrics) : [];

  // Compare
  let mismatches = 0;
  const seen = new Set<string>();

  for (const claim of claims) {
    const metric = metrics.find((m) => m.name === claim.metricName);
    if (!metric) continue;

    const claimed = claim.claimed;

    // Skip small numbers that are likely not total-count claims
    if (claim.metricName === 'test files' && claimed < 100) continue;
    if (claim.metricName === 'packages' && claimed < 10) continue;

    // For test files, allow ±100 drift (files get added/removed frequently)
    const tolerance = claim.metricName === 'test files' ? 100 : 0;
    const drift = Math.abs(claimed - metric.actual);

    if (drift > tolerance && claimed !== metric.actual) {
      const key = `${claim.file}:${claim.line}:${claim.metricName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      mismatches++;
      const direction = claimed > metric.actual ? 'INFLATED' : 'UNDERSTATED';
      console.log(`  DRIFT  ${claim.file}:${claim.line}`);
      console.log(
        `         ${claim.metricName}: claims ${claimed}, actual ${metric.actual} (${direction})`,
      );
      console.log(`         ${claim.text.substring(0, 120)}`);
      if (scanState.showFix) {
        console.log(`         Fix: replace ${claimed} with ${metric.actual}`);
      }
      console.log();
    }
  }

  // Future-tense claim check (CR9-P2-02)
  const futureClaims = scanForFutureTenseClaims();

  // Aspirational-feature blocklist for high-visibility landing + docs copy
  const aspirationalClaims = scanForAspirationalFeatures();

  // Feature-existence copy-dependent holds (COPY-DEP-* in claim-gates)
  const copyDependentClaims = scanForCopyDependentHolds();

  // Fleet-product attribution gate (PR-D)
  const fleetLeaks = scanForFleetProductLeaks();

  // $RVUI internal-ticker leak guard (PR-D)
  const rvuiLeaks = scanForRvuiTickerLeaks();

  // License-membership gates (product-runtime)
  const pkgMap: PackageLicenseMap = scanState.ActiveProfile.licenseScanners
    ? buildPackageLicenseMap()
    : { mit: new Set(), fsl: new Set(), internal: new Set(), all: new Set() };
  const phantomMatches = scanState.ActiveProfile.licenseScanners ? scanForPhantomPackages() : [];
  const membershipMatches = scanState.ActiveProfile.licenseScanners
    ? scanForLicenseMembershipDrift(pkgMap)
    : [];
  const incompleteProMatches = scanState.ActiveProfile.licenseScanners
    ? scanForIncompleteProList(pkgMap)
    : [];
  const licenseSplitAntiMatches = scanState.ActiveProfile.licenseScanners
    ? scanForLicenseSplitAntiPatterns()
    : [];

  // Marketing METRICS drift (Phase 6) — site.ts METRICS vs canonical counts
  const marketingMetricDrifts = scanState.ActiveProfile.marketingMetrics
    ? checkMarketingMetrics([
        { key: 'packages', actual: packages },
        { key: 'apps', actual: apps },
        { key: 'workspaces', actual: workspaces },
        { key: 'uiComponents', actual: uiComponents },
        { key: 'mcpServers', actual: mcpServers },
        { key: 'dbTables', actual: dbTables },
        { key: 'testFiles', actual: testFiles, tolerance: 100 },
        { key: 'mit', actual: licenseSplit.mit },
        { key: 'fsl', actual: licenseSplit.fsl },
        { key: 'internal', actual: licenseSplit.internal },
      ])
    : [];

  // Capability slice is optional (injected by revealui wrapper for product-runtime).

  console.log('====================');
  console.log(`Claims scanned: ${claims.length}`);
  console.log(`Mismatches:     ${mismatches}`);
  console.log(`Future-tense files scanned: ${resolvedFutureTenseFiles().length}`);
  console.log(`Unlinked future-tense markers: ${futureClaims.length}`);
  console.log(`Aspirational-feature scan files: ${resolvedAspirationalPaths().length}`);
  console.log(`Unqualified aspirational features: ${aspirationalClaims.length}`);
  console.log(`Copy-dependent hold hits (feature-existence): ${copyDependentClaims.length}`);
  console.log(`Unattributed fleet-product mentions: ${fleetLeaks.length}`);
  console.log(`Internal $RVUI ticker leaks: ${rvuiLeaks.length}`);
  console.log(`Phantom-package mentions: ${phantomMatches.length}`);
  console.log(`License-membership mismatches: ${membershipMatches.length}`);
  console.log(`Incomplete Pro-list claims: ${incompleteProMatches.length}`);
  console.log(`License-split anti-pattern phrasings: ${licenseSplitAntiMatches.length}`);
  console.log(`Marketing METRICS drift (site.ts): ${marketingMetricDrifts.length}`);
  console.log(
    `Capability claims: ${capability.scanned} scanned, ${capability.proven} proven, ${capability.baselined.length} baselined, ${capability.violations.length} violation(s), ${capability.advisories.length} advisory`,
  );

  if (futureClaims.length > 0) {
    console.log('\nUnlinked future-tense claims (convention: CONTRIBUTING.md):');
    for (const c of futureClaims) {
      console.log(`  ${c.file}:${c.line}  ${c.marker}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEvery future-tense marker must cite a tracker: issue/PR number, milestone, or workflow file.',
    );
  }

  if (aspirationalClaims.length > 0) {
    console.log('\nUnqualified aspirational features:');
    for (const c of aspirationalClaims) {
      console.log(`  ${c.file}:${c.line}  "${c.token}" (${c.why})`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach blocklist token must be paired with a qualifier on the same line: "(coming soon)", "(roadmap)", "(in active development)", "(planned)", or a "Roadmap:" prefix. Or remove the claim.',
    );
  }

  if (copyDependentClaims.length > 0) {
    console.log('\nCopy-dependent holds (feature does not exist yet — live claim forbidden):');
    for (const c of copyDependentClaims) {
      console.log(`  ${c.file}:${c.line}  ${c.token}`);
      console.log(`    ${c.why}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nQualify as roadmap/planned on the same line, or remove the live claim until the feature ships. Then set the hold status to released in packages/claim-gates/src/copy-dependents.ts and cue private COPY-DEP work (.jv copy-dependents.yml).',
    );
  }

  if (fleetLeaks.length > 0) {
    console.log('\nFleet-product mentions without attribution:');
    for (const c of fleetLeaks) {
      console.log(`  ${c.file}:${c.line}  ${c.product}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      `\nEach fleet-product mention must either link to /docs/FLEET or /docs/fleet/<name>, name the source repo (${FLEET_GITHUB_ORG}/<repo>), or include a "(separate product)" attribution. The fleet map and per-product pages under /docs/fleet/ are allowlisted.`,
    );
  }

  if (rvuiLeaks.length > 0) {
    console.log('\n$RVUI internal-codename leaks (must use customer-facing RVC):');
    for (const c of rvuiLeaks) {
      console.log(`  ${c.file}:${c.line}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nThe internal codename `$RVUI` must not appear in public docs. Use `RVC` (the customer-facing on-chain ticker). Lowercase route slugs like `/api/billing/rvui-payment` are fine.',
    );
  }

  if (phantomMatches.length > 0) {
    console.log('\nPhantom-package mentions (package does not live in this monorepo):');
    for (const c of phantomMatches) {
      console.log(`  ${c.file}:${c.line}  ${c.pkg} — ${c.hint}`);
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nRemove the reference, replace with a pointer to the canonical location, or add the file to PHANTOM_PACKAGES allowlist if it explicitly documents the redirect.',
    );
  }

  if (membershipMatches.length > 0) {
    console.log('\nLicense-membership mismatches (package listed under wrong license):');
    for (const c of membershipMatches) {
      console.log(
        `  ${c.file}:${c.line}  ${c.pkg}: claims ${c.claimedLicense}, actually ${c.actualLicense}`,
      );
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nEach line that names a @revealui/<pkg> alongside a license label must match the package.json license. Move the package to the correct license section or remove the claim.',
    );
  }

  if (incompleteProMatches.length > 0) {
    console.log(
      '\nIncomplete Pro-package lists (a strict subset of the FSL set, read as the full set):',
    );
    for (const c of incompleteProMatches) {
      console.log(
        `  ${c.file}:${c.line}  names ${c.named.length} of ${c.total} Pro packages: ${c.named.join(', ')}`,
      );
      console.log(`    ${c.text.substring(0, 140)}`);
    }
    console.log(
      '\nA line that enumerates the Pro/FSL packages must list all of them (see docs/FAIR_SOURCE.md), name only one, or be rephrased so it does not read as the complete set.',
    );
  }

  if (licenseSplitAntiMatches.length > 0) {
    console.log(
      '\nLicense-split anti-pattern phrasings (ambiguous "published"/"private" package counts):',
    );
    for (const m of licenseSplitAntiMatches) {
      console.log(`  ${m.file}:${m.line}  ${m.shape}`);
      console.log(`    ${m.text.substring(0, 140)}`);
    }
    console.log(
      `\nUse the canonical taxonomy instead: "${licenseSplit.mit} MIT + ${licenseSplit.fsl} FSL + ${licenseSplit.internal} internal = ${licenseSplit.mit + licenseSplit.fsl + licenseSplit.internal}". The "published"/"private" split is ambiguous (FSL packages also publish to npm) and historically drifted by 4 on both halves.`,
    );
  }

  if (marketingMetricDrifts.length > 0) {
    console.log(
      '\nMarketing METRICS drift — apps/marketing/app/content/site.ts out of sync with codebase:',
    );
    for (const d of marketingMetricDrifts) {
      const declaredStr = d.declared === null ? 'MISSING' : String(d.declared);
      console.log(`  METRICS.${d.key}: declares ${declaredStr}, actual ${d.actual}`);
    }
    console.log(
      '\nUpdate METRICS in apps/marketing/app/content/site.ts (and docs/MARKETING_METRICS.md §1) to match the codebase counts above.',
    );
  }

  if (capability.advisories.length > 0) {
    console.log('\nCapability-proof advisories (NOT failures — Fable review the production path):');
    for (const a of capability.advisories) {
      console.log(`  ${a.file} :: ${a.exportPath}`);
      console.log(`    ${a.message}`);
    }
  }

  if (capability.baselined.length > 0) {
    console.log(
      `\nGrandfathered capability claims without a kind:'test' proof (baseline, meant to shrink):`,
    );
    for (const key of capability.baselined) {
      console.log(`  ${key}`);
    }
  }

  if (capability.violations.length > 0) {
    console.log("\nCapability claims missing a valid kind:'test' proof:");
    for (const v of capability.violations) {
      if (v.kind === 'denylist') {
        console.log(`  DENYLIST  ${v.file} :: ${v.exportPath} [${v.denylistFamilies?.join(', ')}]`);
        console.log(`    ${v.detail}`);
      } else if (v.kind === 'bad-ref') {
        console.log(`  BAD-REF   ${v.file} :: ${v.exportPath}`);
        console.log(`    ${v.detail}`);
      } else {
        console.log(`  UNPROVEN  ${v.file} :: ${v.exportPath} (markers: ${v.markers?.join(', ')})`);
        console.log(`    ${v.text.substring(0, 120)}`);
      }
    }
    console.log(
      "\nEvery capability-shaped claim must carry a kind:'test' evidence ref in " +
        'apps/marketing/app/content/claims-evidence.ts pointing at a named, non-skipped test ' +
        '("<repo-relative test file>#<exact test title substring>"). Register a real ' +
        'production-path proof, or (marker-only claims only) grandfather it via ' +
        '`pnpm validate:claims --update-capability-baseline`. Denylisted families can never be ' +
        'grandfathered.',
    );
  }

  const anyFailures =
    mismatches > 0 ||
    capability.violations.length > 0 ||
    futureClaims.length > 0 ||
    aspirationalClaims.length > 0 ||
    copyDependentClaims.length > 0 ||
    fleetLeaks.length > 0 ||
    rvuiLeaks.length > 0 ||
    phantomMatches.length > 0 ||
    membershipMatches.length > 0 ||
    incompleteProMatches.length > 0 ||
    licenseSplitAntiMatches.length > 0 ||
    marketingMetricDrifts.length > 0;

  if (anyFailures) {
    if (mismatches > 0) {
      console.log('\nFailed: claims do not match codebase reality.');
      if (!scanState.showFix) {
        console.log('Run with --fix to see suggested corrections.');
      }
    }
    if (futureClaims.length > 0) {
      console.log('\nFailed: unlinked future-tense claims.');
    }
    if (aspirationalClaims.length > 0) {
      console.log('\nFailed: unqualified aspirational features.');
    }
    if (copyDependentClaims.length > 0) {
      console.log('\nFailed: copy-dependent holds (live claim for unshipped feature).');
    }
    if (fleetLeaks.length > 0) {
      console.log('\nFailed: fleet-product mentions without attribution.');
    }
    if (rvuiLeaks.length > 0) {
      console.log('\nFailed: $RVUI internal-codename leaks in public docs.');
    }
    if (phantomMatches.length > 0) {
      console.log('\nFailed: phantom-package mentions in docs.');
    }
    if (membershipMatches.length > 0) {
      console.log('\nFailed: license-membership mismatches in docs.');
    }
    if (incompleteProMatches.length > 0) {
      console.log('\nFailed: incomplete Pro-package lists in docs.');
    }
    if (licenseSplitAntiMatches.length > 0) {
      console.log('\nFailed: license-split anti-pattern phrasings in docs.');
    }
    if (marketingMetricDrifts.length > 0) {
      console.log('\nFailed: marketing METRICS out of sync with codebase counts.');
    }
    if (capability.violations.length > 0) {
      console.log("\nFailed: capability claims without a valid kind:'test' proof.");
    }
  } else {
    console.log(
      '\nAll claims match codebase reality, future-tense markers are tracked, aspirational features are qualified, copy-dependent holds are clear, fleet products are attributed, no $RVUI ticker leaks were found, no phantom-package mentions were found, license membership matches package.json reality, and no license-split anti-pattern phrasings were found.',
    );
  }

  if (scanState.WarnOnly && anyFailures) {
    console.log('\nWARN mode: reporting failures with exit 0 (GAP-462 Phase 2).\n');
  }
  return {
    ok: !anyFailures,
    exitCode: anyFailures && !scanState.WarnOnly ? 1 : 0,
    mismatches,
    capability,
  };
}

export { countDirs };
