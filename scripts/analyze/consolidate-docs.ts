#!/usr/bin/env node

import fs from 'node:fs';

interface VerifiedClaims {
  verified: Array<{
    file: string;
    category: string;
    description: string;
    verification: {
      priority: string;
      action: string;
    };
  }>;
  summary: {
    confirmedFalse: number;
    potentiallyFalse: number;
    needsInvestigation: number;
  };
}

interface ConsolidationPlan {
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    confirmedFalseClaims: number;
    filesToUpdate: string[];
    filesToArchive: string[];
    filesToDelete: string[];
  };
  actions: Array<{
    type: string;
    file: string;
    priority: string;
    description: string;
    claims?: Array<{
      category: string;
      description: string;
      recommendedAction: string;
    }>;
    reason?: string;
  }>;
  newStructure: Record<string, unknown>;
  recommendations: string[];
}

function createConsolidationPlan(): ConsolidationPlan {
  console.log('📋 Creating documentation consolidation plan...\n');

  const verifiedClaims: VerifiedClaims = JSON.parse(
    fs.readFileSync('docs/verified-claims.json', 'utf8'),
  );
  const auditResults = JSON.parse(fs.readFileSync('docs/audit-results.json', 'utf8'));

  const plan: ConsolidationPlan = {
    summary: {
      totalFiles: auditResults.totalFiles,
      filesWithIssues: Object.keys(
        verifiedClaims.verified.reduce((acc: Record<string, boolean>, claim) => {
          acc[claim.file] = true;
          return acc;
        }, {}),
      ).length,
      confirmedFalseClaims: verifiedClaims.summary.confirmedFalse,
      filesToUpdate: [],
      filesToArchive: [],
      filesToDelete: [],
    },
    actions: [],
    newStructure: {},
    recommendations: [],
  };

  // Categorize files by action needed
  const fileActions = categorizeFiles(verifiedClaims.verified);

  plan.summary.filesToUpdate = fileActions.update;
  plan.summary.filesToArchive = fileActions.archive;
  plan.summary.filesToDelete = fileActions.delete;

  // Create detailed action plan
  plan.actions = createActionPlan(fileActions, verifiedClaims.verified);

  // Design new documentation structure
  plan.newStructure = designNewStructure();

  // Generate recommendations
  plan.recommendations = generateRecommendations();

  // Generate consolidation report
  console.log('📊 CONSOLIDATION PLAN COMPLETE\n');
  console.log('='.repeat(50));
  console.log('DOCUMENTATION CONSOLIDATION REPORT');
  console.log('='.repeat(50));

  console.log(`\n📈 Current State:`);
  console.log(`   Total files: ${plan.summary.totalFiles}`);
  console.log(`   Files with issues: ${plan.summary.filesWithIssues}`);
  console.log(`   Confirmed false claims: ${plan.summary.confirmedFalseClaims}`);

  console.log(`\n🔧 Required Actions:`);
  console.log(`   Files to update: ${plan.summary.filesToUpdate.length}`);
  console.log(`   Files to archive: ${plan.summary.filesToArchive.length}`);
  console.log(`   Files to delete: ${plan.summary.filesToDelete.length}`);

  console.log(`\n📁 New Structure:`);
  Object.entries(plan.newStructure).forEach(([section, items]) => {
    console.log(
      `   ${section}: ${Array.isArray(items) ? items.length : Object.keys(items).length} items`,
    );
  });

  console.log(`\n💡 Key Recommendations:`);
  plan.recommendations.slice(0, 5).forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });

  // Save plan
  fs.writeFileSync('docs/consolidation-plan.json', JSON.stringify(plan, null, 2));
  console.log(`\n💾 Detailed plan saved to: docs/consolidation-plan.json`);

  return plan;
}

function categorizeFiles(verifiedClaims: VerifiedClaims['verified']): {
  update: string[];
  archive: string[];
  delete: string[];
} {
  const actions = {
    update: [] as string[],
    archive: [] as string[],
    delete: [] as string[],
  };

  // Get all unique files with issues
  const filesWithIssues = [...new Set(verifiedClaims.map((c) => c.file))];

  filesWithIssues.forEach((file) => {
    // Archive old assessment files
    if (
      file.includes('/assessments/') ||
      file.includes('BRUTAL_') ||
      file.includes('PHASE_*_COMPLETE') ||
      file.match(/\b202[6-9]\b/)
    ) {
      actions.archive.push(file);
    }
    // Delete completely outdated or redundant files
    else if (
      (file.includes('archive/') && file.includes('duplicate')) ||
      file.includes('old/') ||
      file.includes('backup')
    ) {
      actions.delete.push(file);
    }
    // Update files that need corrections
    else {
      actions.update.push(file);
    }
  });

  return actions;
}

function createActionPlan(
  fileActions: ReturnType<typeof categorizeFiles>,
  verifiedClaims: VerifiedClaims['verified'],
) {
  const actions: ConsolidationPlan['actions'] = [];

  // Update actions
  fileActions.update.forEach((file) => {
    const claims = verifiedClaims.filter((c) => c.file === file);
    actions.push({
      type: 'update',
      file: file,
      priority: claims.some((c) => c.verification.priority === 'critical') ? 'critical' : 'high',
      description: `Fix ${claims.length} false claims in ${file}`,
      claims: claims.map((c) => ({
        category: c.category,
        description: c.description,
        recommendedAction: c.verification.action,
      })),
    });
  });

  // Archive actions
  fileActions.archive.forEach((file) => {
    actions.push({
      type: 'archive',
      file: file,
      priority: 'medium',
      description: `Move outdated file to archive: ${file}`,
      reason: 'Contains outdated information or future dates',
    });
  });

  // Delete actions
  fileActions.delete.forEach((file) => {
    actions.push({
      type: 'delete',
      file: file,
      priority: 'low',
      description: `Remove redundant file: ${file}`,
      reason: 'Duplicate or completely outdated content',
    });
  });

  return actions;
}

function designNewStructure(): Record<string, unknown> {
  const coreDocumentation = Object.fromEntries([
    ['Status', ['docs/STATUS.md', 'docs/PRODUCTION_READINESS.md', 'docs/PRODUCTION_ROADMAP.md']],
    ['Architecture', ['docs/architecture/', 'docs/planning/']],
    ['Development', ['docs/development/', 'docs/automation/']],
    ['Reference', ['docs/reference/', 'docs/api/']],
  ]);
  const assessments = Object.fromEntries([
    ['Active', ['docs/assessments/README.md']],
    ['Archive', ['docs/archive/assessments/']],
  ]);
  const maintenance = Object.fromEntries([
    ['Standards', ['docs/STANDARDS.md']],
    ['Navigation', ['docs/NAVIGATION.md']],
    ['Audit Tools', ['scripts/audit-docs.ts', 'scripts/verify-claims.ts']],
  ]);
  return Object.fromEntries([
    ['Getting Started', ['README.md', 'docs/guides/QUICK_START.md', 'docs/guides/ONBOARDING.md']],
    ['Core Documentation', coreDocumentation],
    ['Assessments', assessments],
    ['Maintenance', maintenance],
  ]);
}

function generateRecommendations(): string[] {
  return [
    'Establish docs/STANDARDS.md as documentation guidelines',
    'Create docs/NAVIGATION.md for easy discovery',
    'Implement monthly documentation audits',
    'Require verification dates on all metrics',
    'Archive old assessments automatically after 30 days',
    'Establish single sources of truth for all status information',
    'Implement automated claim verification in CI/CD',
    'Create documentation templates for consistent format',
    'Set up documentation ownership and review processes',
    'Add documentation quality metrics to development KPIs',
  ];
}

// Run consolidation planning
createConsolidationPlan();
