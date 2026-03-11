/**
 * Assessment Template Generation for Cohesion Engine
 *
 * Generates markdown assessment documents from analysis results.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions (CohesionAnalysis, CohesionIssue, Metric)
 */

import type { CohesionAnalysis, CohesionIssue, Metric } from '../types.ts';

/**
 * Generate a markdown assessment document from analysis results
 */
export function generateAssessment(analysis: CohesionAnalysis): string {
  const sections: string[] = [];

  sections.push(generateHeader(analysis));
  sections.push(generateExecutiveSummary(analysis));
  sections.push(generateIssueBreakdown(analysis));
  sections.push(generateMetricsSection(analysis.metrics));
  sections.push(generateRecommendations(analysis));
  sections.push(generateActionItems(analysis));

  return sections.join('\n\n');
}

function generateHeader(analysis: CohesionAnalysis): string {
  return [
    '# Developer Experience Cohesion Analysis',
    '',
    `> Generated: ${analysis.timestamp}`,
    `> Grade: **${analysis.summary.overallGrade}**`,
    `> Issues: ${analysis.summary.totalIssues} total`,
  ].join('\n');
}

function generateExecutiveSummary(analysis: CohesionAnalysis): string {
  const { summary } = analysis;
  const lines = [
    '## Executive Summary',
    '',
    `The codebase has **${summary.totalIssues}** cohesion issues: ${getSeverityBreakdown(summary)}.`,
    '',
    `Overall grade: **${summary.overallGrade}**`,
  ];

  if (summary.criticalIssues > 0) {
    lines.push('', `**${summary.criticalIssues} critical issues** require immediate attention.`);
  }

  if (summary.highIssues > 0) {
    lines.push(
      '',
      `**${summary.highIssues} high-priority issues** should be addressed this sprint.`,
    );
  }

  return lines.join('\n');
}

function getSeverityBreakdown(summary: CohesionAnalysis['summary']): string {
  const parts: string[] = [];
  if (summary.criticalIssues > 0) parts.push(`${summary.criticalIssues} critical`);
  if (summary.highIssues > 0) parts.push(`${summary.highIssues} high`);
  if (summary.mediumIssues > 0) parts.push(`${summary.mediumIssues} medium`);
  if (summary.lowIssues > 0) parts.push(`${summary.lowIssues} low`);
  return parts.join(', ');
}

function generateIssueBreakdown(analysis: CohesionAnalysis): string {
  const lines = ['## Issue Breakdown', ''];

  const sortedIssues = [...analysis.issues].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });

  for (const issue of sortedIssues) {
    lines.push(`### ${severityIcon(issue.severity)} ${issue.title}`);
    lines.push('');
    lines.push(`- **Severity:** ${issue.severity}`);
    lines.push(`- **Impact:** ${issue.impact}`);
    if (issue.count !== undefined) {
      lines.push(`- **Count:** ${issue.count} instances`);
    }
    lines.push(`- **Description:** ${issue.description}`);
    lines.push('');

    if (issue.evidence.length > 0) {
      lines.push('**Evidence:**');
      lines.push('');
      for (const evidence of issue.evidence.slice(0, 5)) {
        lines.push(`- \`${evidence.file}:${evidence.line}\``);
        if (evidence.code) {
          lines.push('  ```ts');
          lines.push(`  ${evidence.code.trim()}`);
          lines.push('  ```');
        }
      }
      if (issue.evidence.length > 5) {
        lines.push(`- ... and ${issue.evidence.length - 5} more`);
      }
      lines.push('');
    }

    if (issue.recommendation) {
      lines.push(`**Recommendation:** ${issue.recommendation}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateMetricsSection(metrics: Metric[]): string {
  const lines = ['## Metrics', '', '| Metric | Value |', '|--------|-------|'];

  for (const metric of metrics) {
    const value =
      metric.percentage !== undefined
        ? `${metric.value} (${metric.percentage.toFixed(1)}%)`
        : String(metric.value);
    lines.push(`| ${metric.name} | ${value} |`);
  }

  return lines.join('\n');
}

function generateRecommendations(analysis: CohesionAnalysis): string {
  const lines = ['## Recommendations', ''];
  let priority = 1;

  const criticalIssues = analysis.issues.filter((i) => i.severity === 'CRITICAL');
  const highIssues = analysis.issues.filter((i) => i.severity === 'HIGH');

  if (criticalIssues.length > 0) {
    lines.push('### Immediate (Critical)');
    for (const issue of criticalIssues) {
      lines.push(
        `${priority}. **${issue.title}** \u2014 ${issue.recommendation ?? issue.description}`,
      );
      priority++;
    }
    lines.push('');
  }

  if (highIssues.length > 0) {
    lines.push('### This Sprint (High Priority)');
    for (const issue of highIssues) {
      lines.push(
        `${priority}. **${issue.title}** \u2014 ${issue.recommendation ?? issue.description}`,
      );
      priority++;
    }
    lines.push('');
  }

  const otherIssues = analysis.issues.filter(
    (i) => i.severity !== 'CRITICAL' && i.severity !== 'HIGH',
  );
  if (otherIssues.length > 0) {
    lines.push('### Backlog (Medium/Low)');
    for (const issue of otherIssues) {
      lines.push(
        `${priority}. **${issue.title}** \u2014 ${issue.recommendation ?? issue.description}`,
      );
      priority++;
    }
  }

  return lines.join('\n');
}

function generateActionItems(analysis: CohesionAnalysis): string {
  const lines = [
    '## Action Items',
    '',
    '| # | Action | Severity | Automated Fix? |',
    '|---|--------|----------|----------------|',
  ];

  for (let i = 0; i < analysis.issues.length; i++) {
    const issue = analysis.issues[i];
    const automated = hasAutomatedFix(issue) ? 'Yes' : 'No';
    lines.push(`| ${i + 1} | ${issue.title} | ${issue.severity} | ${automated} |`);
  }

  return lines.join('\n');
}

function severityIcon(severity: CohesionIssue['severity']): string {
  switch (severity) {
    case 'CRITICAL':
      return '\ud83d\udd34';
    case 'HIGH':
      return '\ud83d\udfe0';
    case 'MEDIUM':
      return '\ud83d\udfe1';
    case 'LOW':
      return '\ud83d\udfe2';
  }
}

function hasAutomatedFix(issue: CohesionIssue): boolean {
  const automatedPatterns = ['type-assertion-any', 'unscoped-import', 'console-log'];
  return issue.pattern !== undefined && automatedPatterns.includes(issue.pattern);
}
