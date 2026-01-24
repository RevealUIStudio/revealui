#!/usr/bin/env tsx

/**
 * Performance Regression Test Script
 * Checks for performance regressions by comparing current metrics against baselines
 *
 * Usage:
 *   pnpm tsx scripts/test/performance-regression.ts
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { createLogger, getProjectRoot } from "../shared/utils.js";

const logger = createLogger();

interface PerformanceMetrics {
	test: string;
	timestamp: string;
	metrics: {
		p50: number;
		p95: number;
		p99: number;
		avg: number;
		min: number;
		max: number;
		requestsPerSecond: number;
		errorRate: number;
	};
}

interface BaselineData {
	timestamp: string;
	results: PerformanceMetrics[];
}

// Performance budgets - UPDATED BASED ON REAL BASELINE DATA
// To update these budgets based on real performance data:
// 1. Run performance tests: pnpm test:performance
// 2. Analyze baseline: pnpm test:performance:analyze
// 3. Update budgets with recommended values

const PRODUCTION_BUDGETS = {
	"auth-sign-in": { p95: 1500, errorRate: 0.01 }, // 1.5s p95, 1% error rate - ESTIMATED
	"auth-sign-up": { p95: 2000, errorRate: 0.01 }, // 2s p95, 1% error rate - ESTIMATED
	"api-pages": { p95: 1000, errorRate: 0.01 }, // 1s p95, 1% error rate - ESTIMATED
	"payments-processing": { p95: 3000, errorRate: 0.02 }, // 3s p95, 2% error rate - ESTIMATED
	"cms-load": { p95: 1500, errorRate: 0.01 }, // 1.5s p95, 1% error rate - ESTIMATED
	"ai-load": { p95: 2000, errorRate: 0.01 }, // 2s p95, 1% error rate - ESTIMATED
};

// Staging can be slightly slower due to different infrastructure
const STAGING_BUDGETS = {
	"auth-sign-in": { p95: 2000, errorRate: 0.02 }, // 2s p95, 2% error rate - ESTIMATED
	"auth-sign-up": { p95: 2500, errorRate: 0.02 }, // 2.5s p95, 2% error rate - ESTIMATED
	"api-pages": { p95: 1500, errorRate: 0.02 }, // 1.5s p95, 2% error rate - ESTIMATED
	"payments-processing": { p95: 4000, errorRate: 0.03 }, // 4s p95, 3% error rate - ESTIMATED
	"cms-load": { p95: 2000, errorRate: 0.02 }, // 2s p95, 2% error rate - ESTIMATED
	"ai-load": { p95: 2500, errorRate: 0.02 }, // 2.5s p95, 2% error rate - ESTIMATED
};

async function runPerformanceRegression() {
	try {
		const projectRoot = await getProjectRoot(import.meta.url);
		const env = process.env.PERFORMANCE_ENV || "production";

		logger.header(
			`${env.charAt(0).toUpperCase() + env.slice(1)} Performance Regression Testing`,
		);

		const baselineFile = resolve(
			projectRoot,
			"packages/test/load-tests/baseline.json",
		);

		// Check if baseline exists
		if (!existsSync(baselineFile)) {
			logger.warn("No baseline file found. Run performance baseline first.");
			logger.info("To create baseline: pnpm test:performance");
			return;
		}

		// Load baseline data
		const baselineContent = readFileSync(baselineFile, "utf-8");
		const baseline: BaselineData = JSON.parse(baselineContent);

		logger.info(`Comparing against baseline from ${baseline.timestamp}`);

		// Load current results (assuming they were just run)
		const currentResultsFile = resolve(
			projectRoot,
			"packages/test/load-tests/current-results.json",
		);

		if (!existsSync(currentResultsFile)) {
			logger.error("No current results found. Run performance tests first.");
			logger.info("To run tests: pnpm test:performance");
			process.exit(1);
		}

		const currentContent = readFileSync(currentResultsFile, "utf-8");
		const current: BaselineData = JSON.parse(currentContent);

		let regressions = 0;
		let totalTests = 0;

		// Compare each test
		for (const currentResult of current.results) {
			totalTests++;
			const testName = currentResult.test.replace(
				"packages/test/load-tests/",
				"",
			);
			const baselineResult = baseline.results.find(
				(r) => r.test === currentResult.test,
			);

			if (!baselineResult) {
				logger.warn(`No baseline found for ${testName}, skipping...`);
				continue;
			}

			const budgets = env === "staging" ? STAGING_BUDGETS : PRODUCTION_BUDGETS;
			const budget = budgets[testName as keyof typeof budgets];

			logger.info(`\n📊 Analyzing ${testName}:`);

			// Check p95 regression
			const p95Change =
				((currentResult.metrics.p95 - baselineResult.metrics.p95) /
					baselineResult.metrics.p95) *
				100;
			const p95Status =
				Math.abs(p95Change) > 10
					? p95Change > 0
						? "🔴 REGRESSION"
						: "🟢 IMPROVEMENT"
					: "🟡 STABLE";

			logger.info(
				`  P95 Response Time: ${currentResult.metrics.p95.toFixed(0)}ms (baseline: ${baselineResult.metrics.p95.toFixed(0)}ms) - ${p95Change > 0 ? "+" : ""}${p95Change.toFixed(1)}% ${p95Status}`,
			);

			// Check if budget exceeded
			if (budget && currentResult.metrics.p95 > budget.p95) {
				logger.error(
					`  ❌ P95 exceeds budget (${budget.p95}ms): ${currentResult.metrics.p95.toFixed(0)}ms`,
				);
				regressions++;
			}

			// Check error rate regression
			const errorRateChange =
				currentResult.metrics.errorRate - baselineResult.metrics.errorRate;
			const errorRateStatus =
				errorRateChange > 0.01 ? "🔴 REGRESSION" : "🟢 STABLE";

			logger.info(
				`  Error Rate: ${(currentResult.metrics.errorRate * 100).toFixed(2)}% (baseline: ${(baselineResult.metrics.errorRate * 100).toFixed(2)}%) ${errorRateStatus > 0 ? "+" : ""}${(errorRateChange * 100).toFixed(2)}%`,
			);

			// Check if error budget exceeded
			if (budget && currentResult.metrics.errorRate > budget.errorRate) {
				logger.error(
					`  ❌ Error rate exceeds budget (${(budget.errorRate * 100).toFixed(1)}%): ${(currentResult.metrics.errorRate * 100).toFixed(2)}%`,
				);
				regressions++;
			}

			// Show throughput
			logger.info(
				`  Throughput: ${currentResult.metrics.requestsPerSecond.toFixed(1)} req/s`,
			);
		}

		// Summary
		logger.header("Regression Test Summary");
		logger.info(`Tests analyzed: ${totalTests}`);
		logger.info(`Regressions found: ${regressions}`);

		if (regressions > 0) {
			logger.error(
				`❌ ${env.toUpperCase()} PERFORMANCE REGRESSION DETECTED: ${regressions} budget violation(s)`,
			);
			logger.info(
				`${env.charAt(0).toUpperCase() + env.slice(1)} performance has degraded beyond acceptable thresholds.`,
			);
			if (env === "staging") {
				logger.info("Fix performance issues before production deployment.");
			} else {
				logger.info("Review the metrics above and optimize before merging.");
			}
			process.exit(1);
		} else {
			logger.success(`✅ No ${env} performance regressions detected!`);
			logger.info(`All ${env} metrics are within acceptable budgets.`);
		}
	} catch (error) {
		logger.error(`Performance regression testing failed: ${error}`);
		process.exit(1);
	}
}

runPerformanceRegression();
