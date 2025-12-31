#!/usr/bin/env tsx
/**
 * Code quality analysis script
 * Analyzes TODOs, any types, and documentation coverage
 */

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "fast-glob";

interface AnalysisResult {
  file: string;
  todos: number;
  anyTypes: number;
  jsdocFunctions: number;
  totalFunctions: number;
}

async function analyzeFile(filePath: string): Promise<AnalysisResult> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const todos = (content.match(/TODO|FIXME|HACK/gi) || []).length;
  const anyTypes = (content.match(/:\s*any\b/g) || []).length;

  // Count functions with and without JSDoc
  const functionRegex = /^(export\s+)?(async\s+)?function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(/gm;
  const jsdocRegex = /\/\*\*[\s\S]*?\*\/\s*(export\s+)?(async\s+)?function|const\s+\w+\s*=\s*(async\s+)?\(/g;

  const functions = (content.match(functionRegex) || []).length;
  const jsdocFunctions = (content.match(jsdocRegex) || []).length;

  return {
    file: path.relative(process.cwd(), filePath),
    todos,
    anyTypes,
    jsdocFunctions,
    totalFunctions: functions,
  };
}

async function main() {
  const files = await glob("packages/reveal/src/**/*.{ts,tsx}", {
    ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**", "**/dist/**"],
  });

  const results: AnalysisResult[] = [];
  let totalTodos = 0;
  let totalAnyTypes = 0;
  let totalJSDocFunctions = 0;
  let totalFunctions = 0;

  for (const file of files) {
    const result = await analyzeFile(file);
    results.push(result);
    totalTodos += result.todos;
    totalAnyTypes += result.anyTypes;
    totalJSDocFunctions += result.jsdocFunctions;
    totalFunctions += result.totalFunctions;
  }

  // Sort by priority (todos + anyTypes)
  results.sort((a, b) => (b.todos + b.anyTypes) - (a.todos + a.anyTypes));

  console.log("Code Quality Analysis Report\n");
  console.log("=" .repeat(50));
  console.log(`Total Files Analyzed: ${results.length}`);
  console.log(`Total TODOs: ${totalTodos}`);
  console.log(`Total Any Types: ${totalAnyTypes}`);
  console.log(`JSDoc Coverage: ${((totalJSDocFunctions / totalFunctions) * 100).toFixed(1)}%`);
  console.log("\nTop 20 Files Needing Attention:\n");

  results.slice(0, 20).forEach((result, index) => {
    if (result.todos > 0 || result.anyTypes > 0) {
      console.log(
        `${index + 1}. ${result.file}\n   TODOs: ${result.todos}, Any Types: ${result.anyTypes}`
      );
    }
  });

  // Write detailed report
  const reportPath = path.join(process.cwd(), "CODE-QUALITY-REPORT.json");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        summary: {
          totalFiles: results.length,
          totalTodos,
          totalAnyTypes,
          jsdocCoverage: ((totalJSDocFunctions / totalFunctions) * 100).toFixed(1) + "%",
        },
        files: results,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\nDetailed report written to: ${reportPath}`);
}

main().catch(console.error);

