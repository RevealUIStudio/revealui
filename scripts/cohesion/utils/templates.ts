/**
 * Assessment template utilities for Cohesion Engine
 */

import type { CohesionAnalysis, CohesionIssue, Metric } from '../types.js'

/**
 * Generate markdown assessment document from analysis
 */
export function generateAssessment(analysis: CohesionAnalysis): string {
  const timestamp = new Date(analysis.timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const markdown = `# Brutal Developer Experience Assessment: RevealUI Framework

**Date**: ${timestamp}  
**Assessor**: Cohesion Engine (Automated)  
**Total Issues Analyzed**: ${analysis.summary.totalIssues}  
**Overall Grade**: **${analysis.summary.overallGrade}**

---

## Executive Summary

${generateExecutiveSummary(analysis)}

---

## Quantitative Evidence

${generateQuantitativeEvidence(analysis.metrics)}

---

## Critical Developer Friction Points

${generateCriticalIssues(analysis.issues.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH'))}

---

## Cohesion Gaps

${generateGaps(analysis.issues)}

---

## Overall Assessment

${generateOverallAssessment(analysis)}

---

## Required Fixes

${generateRequiredFixes(analysis.issues)}

---

## Success Metrics

${generateSuccessMetrics(analysis.metrics)}

---

## Conclusion

${generateConclusion(analysis)}

---

**Document Version**: 1.0  
**Last Updated**: ${timestamp}  
**Assessment Grade**: ${analysis.summary.overallGrade}
`

  return markdown
}

function generateExecutiveSummary(analysis: CohesionAnalysis): string {
  const { summary } = analysis
  const criticalCount = summary.criticalIssues
  const highCount = summary.highIssues

  return `The RevealUI Framework's developer experience is **functional but deeply frustrating**. While the code works, developers face **systematic friction** at every integration point. The framework suffers from **critical cohesion failures** that force developers to work around framework issues rather than building features.

**Key Findings**:
- **${summary.totalIssues} cohesion issues** identified across the codebase
- **${criticalCount} critical issues** requiring immediate attention
- **${highCount} high-priority issues** causing developer friction
- **${summary.overallGrade}** - The framework works, but developer experience needs serious improvement

**Bottom Line**: The framework works, but every integration requires developers to rediscover patterns, work around TypeScript issues, and copy-paste boilerplate. It's not broken, but it's not pleasant either. Developers spend more time fighting the framework than building features.`
}

function generateQuantitativeEvidence(metrics: Metric[]): string {
  const fileMetric = metrics.find((m) => m.name === 'Files Affected')
  const instanceMetric = metrics.find((m) => m.name === 'Total Pattern Instances')

  let evidence = `### Pattern Analysis

- **${instanceMetric?.value || 0} pattern instances** found across the codebase
- **${fileMetric?.value || 0} files** affected by cohesion issues

### Issue Breakdown

`

  for (const metric of metrics.filter((m) => m.name.includes('Instances'))) {
    evidence += `- **${metric.value} instances** of ${metric.description || metric.name}\n`
  }

  evidence += `\n### Code Locations
See specific examples with file:line references below.`

  return evidence
}

function generateCriticalIssues(issues: CohesionIssue[]): string {
  if (issues.length === 0) {
    return `No critical issues found.`
  }

  let critical = ''

  for (const issue of issues) {
    critical += `### Issue ${issue.id}: ${issue.title}

**Severity: ${issue.severity}**  
**Impact: ${issue.impact}**

${issue.description}

**Evidence**:
`

    for (const evidence of issue.evidence.slice(0, 5)) {
      const relativePath = evidence.file.includes(process.cwd())
        ? evidence.file.replace(process.cwd(), '').replace(/^\//, '')
        : evidence.file.replace(/^.*\/(apps|packages)\//, '$1/')
      critical += `\`\`\`${evidence.line}:${evidence.line}:${relativePath}\n${evidence.code}\n\`\`\`\n\n`
    }

    if (issue.evidence.length > 5) {
      critical += `_... ${issue.evidence.length - 5} more instances_\n\n`
    }

    if (issue.recommendation) {
      critical += `**Recommendation**: ${issue.recommendation}\n\n`
    }

    critical += `---\n\n`
  }

  return critical
}

function generateGaps(issues: CohesionIssue[]): string {
  if (issues.length === 0) {
    return `No cohesion gaps found.`
  }

  let gaps = ''

  const groupedBySeverity = Object.fromEntries([
    ['CRITICAL', issues.filter((i) => i.severity === 'CRITICAL')],
    ['HIGH', issues.filter((i) => i.severity === 'HIGH')],
    ['MEDIUM', issues.filter((i) => i.severity === 'MEDIUM')],
    ['LOW', issues.filter((i) => i.severity === 'LOW')],
  ])

  for (const [severity, severityIssues] of Object.entries(groupedBySeverity)) {
    if (severityIssues.length === 0) continue

    gaps += `### ${severity} Severity Issues\n\n`

    for (const issue of severityIssues) {
      gaps += `#### ${issue.title}

**Severity: ${severity}**  
**Impact: ${issue.impact}**

**Evidence**:
`

      for (const evidence of issue.evidence.slice(0, 3)) {
        const relativePath = evidence.file.includes(process.cwd())
          ? evidence.file.replace(process.cwd(), '').replace(/^\//, '')
          : evidence.file.replace(/^.*\/(apps|packages)\//, '$1/')
        gaps += `- \`${relativePath}:${evidence.line}\` - ${evidence.code.slice(0, 60)}${evidence.code.length > 60 ? '...' : ''}\n`
      }

      if (issue.evidence.length > 3) {
        gaps += `- _... ${issue.evidence.length - 3} more instances_\n`
      }

      gaps += `\n**Problem**: ${issue.description}\n\n`
    }
  }

  return gaps
}

function generateOverallAssessment(analysis: CohesionAnalysis): string {
  const { summary } = analysis

  return `**Grade: ${summary.overallGrade}**

### What Works

- Framework functions correctly
- Packages are separated logically
- Code is readable
- Features work as intended

### What Doesn't Work

- **Developer experience is frustrating** - too much boilerplate everywhere
- **${summary.criticalIssues > 0 ? `${summary.criticalIssues} critical` : ''} issues** requiring immediate attention
- **${summary.highIssues > 0 ? `${summary.highIssues} high-priority` : ''} issues** causing developer friction
- **No integration utilities** - everything is manual
- **Type system fragmented** - types scattered across packages

### Would I Use This?

- **For internal tools**: Yes, but with significant frustration
- **For client projects**: No, not until DX issues fixed
- **For open source**: Needs significant DX improvements first

**Bottom Line**: The framework works, but developer experience needs serious improvement. The architecture is sound, but the integration layer is missing. Developers must fight the framework to get things done. Every integration requires workarounds, type assertions, and boilerplate. This is not acceptable for a framework claiming to be "enterprise-grade."`
}

function generateRequiredFixes(issues: CohesionIssue[]): string {
  const criticalIssues = issues.filter((i) => i.severity === 'CRITICAL')
  const highIssues = issues.filter((i) => i.severity === 'HIGH')
  const mediumIssues = issues.filter((i) => i.severity === 'MEDIUM')

  let fixes = `### Priority 1: Critical Fixes (Must Do)

`

  if (criticalIssues.length > 0) {
    for (const issue of criticalIssues) {
      fixes += `1. **Fix ${issue.title}**
   - ${issue.recommendation || 'Address the root cause'}
   - Files affected: ${new Set(issue.evidence.map((e) => e.file)).size}

`
    }
  } else {
    fixes += `No critical fixes required.\n\n`
  }

  fixes += `### Priority 2: High-Impact Improvements (Should Do)

`

  if (highIssues.length > 0) {
    for (const issue of highIssues.slice(0, 5)) {
      fixes += `1. **Fix ${issue.title}**
   - ${issue.recommendation || 'Address the root cause'}

`
    }
  } else {
    fixes += `No high-priority fixes required.\n\n`
  }

  fixes += `### Priority 3: Quality of Life (Nice to Have)

1. **Address medium-priority issues** (${mediumIssues.length} issues)
2. **Improve documentation**
3. **Create integration utilities**

`

  return fixes
}

function generateSuccessMetrics(_metrics: Metric[]): string {
  return `### Developer Experience Metrics

1. **Type Safety**: Zero type assertions required
2. **Code Duplication**: Zero duplicate patterns
3. **Import Consistency**: 100% of imports use standardized aliases
4. **Developer Feedback**: Positive feedback on integration experience

### Code Quality Metrics

1. **Type Safety**: 100% type coverage
2. **Test Coverage**: 90% test coverage for integration utilities
3. **API Surface**: Minimal, focused API surface
4. **Documentation**: 100% of integration patterns documented`
}

function generateConclusion(analysis: CohesionAnalysis): string {
  const { summary } = analysis

  return `The RevealUI Framework has a solid architectural foundation but suffers from **critical developer experience failures**. The framework works, but developers face systematic friction at every integration point. Type safety is broken, patterns are inconsistent, and workarounds are required.

**The framework is not production-ready for developer experience**, despite being functionally correct. Serious improvements are needed before it can be recommended for client projects or open source adoption.

**Recommended Next Steps**:
1. Fix critical issues (${summary.criticalIssues} issues)
2. Address high-priority issues (${summary.highIssues} issues)
3. Create integration utilities
4. Standardize import patterns

**Bottom Line**: Fix the developer experience, or developers will choose a different framework. The current state is not acceptable for an enterprise-grade framework.`
}
