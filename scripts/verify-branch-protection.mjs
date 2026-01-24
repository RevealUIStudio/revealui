#!/usr/bin/env node

import { execSync } from "child_process";

const REPO = process.env.GITHUB_REPOSITORY || "joshua-v-dev/RevealUI";
const BRANCH = "main";

console.log(`🔍 Verifying branch protection for ${REPO}:${BRANCH}\n`);

try {
	// Get branch protection rules
	const cmd = `gh api repos/${REPO}/branches/${BRANCH}/protection`;
	const protection = JSON.parse(execSync(cmd, { encoding: "utf8" }));

	console.log("✅ Branch protection is enabled\n");

	// Check required status checks
	const requiredChecks = protection.required_status_checks?.contexts || [];
	console.log(`📋 Required status checks (${requiredChecks.length}):`);
	requiredChecks.forEach((check) => console.log(`   • ${check}`));
	console.log("");

	// Define critical checks that must be present
	const criticalChecks = [
		"validate-config",
		"lint",
		"typecheck",
		"test",
		"security-scan",
		"build-cms",
		"build-web",
	];

	const securityChecks = [
		"snyk-security",
		"secret-scanning",
		"dependency-review",
		"codeql-analysis",
	];

	// Check for missing critical checks
	const missingCritical = criticalChecks.filter(
		(check) => !requiredChecks.includes(check),
	);

	const missingSecurity = securityChecks.filter(
		(check) => !requiredChecks.includes(check),
	);

	if (missingCritical.length > 0) {
		console.error(
			`❌ Missing critical CI checks: ${missingCritical.join(", ")}`,
		);
		console.error("These are required for basic code quality assurance.\n");
	} else {
		console.log("✅ All critical CI checks are configured");
	}

	if (missingSecurity.length > 0) {
		console.error(`❌ Missing security checks: ${missingSecurity.join(", ")}`);
		console.error("These are required for security vulnerability detection.\n");
	} else {
		console.log("✅ All security checks are configured");
	}

	// Check PR review requirements
	const reviews = protection.required_pull_request_reviews;
	if (!reviews) {
		console.error("❌ Pull request reviews not configured");
		console.error("Code reviews are required for security and quality.\n");
	} else {
		console.log("✅ Pull request reviews configured:");
		console.log(
			`   • Required approving reviews: ${reviews.required_approving_review_count || 0}`,
		);
		console.log(
			`   • Dismiss stale reviews: ${reviews.dismiss_stale_reviews ? "Yes" : "No"}`,
		);
		console.log(
			`   • Require code owner reviews: ${reviews.require_code_owner_reviews ? "Yes" : "No"}`,
		);

		if (reviews.required_approving_review_count < 1) {
			console.error("❌ At least 1 approving review should be required\n");
		} else {
			console.log("✅ Review requirements meet minimum standards");
		}
	}

	// Check admin enforcement
	if (protection.enforce_admins?.enabled) {
		console.log("✅ Administrator enforcement enabled");
	} else {
		console.warn("⚠️ Administrator enforcement not enabled");
		console.warn("Administrators can bypass branch protection rules\n");
	}

	// Check restrictions
	const restrictions = protection.restrictions;
	if (restrictions) {
		console.log("✅ Additional restrictions configured");
	}

	// Check force push restrictions
	if (protection.allow_force_pushes?.enabled === false) {
		console.log("✅ Force pushes disabled");
	} else {
		console.warn("⚠️ Force pushes not disabled");
		console.warn("Force pushes can bypass branch protection\n");
	}

	// Check deletion restrictions
	if (protection.allow_deletions?.enabled === false) {
		console.log("✅ Branch deletions disabled");
	} else {
		console.warn("⚠️ Branch deletions not disabled");
		console.warn("Protected branches should not be deletable\n");
	}

	// Overall assessment
	const issues =
		missingCritical.length +
		missingSecurity.length +
		(reviews?.required_approving_review_count < 1 ? 1 : 0);

	console.log("\n" + "=".repeat(50));
	if (issues === 0) {
		console.log("🎉 BRANCH PROTECTION VERIFICATION PASSED!");
		console.log("Your main branch is properly protected.");
	} else {
		console.log(`❌ BRANCH PROTECTION ISSUES FOUND: ${issues} issue(s)`);
		console.log(
			"Please address the issues above before deploying to production.",
		);
		console.log(
			"\nTo fix: Go to repository Settings → Branches → main branch rules",
		);
		process.exit(1);
	}
	console.log("=".repeat(50));
} catch (error) {
	if (error.message.includes("404") || error.message.includes("Not Found")) {
		console.error("❌ Branch protection not configured");
		console.error(`No protection rules found for ${REPO}:${BRANCH}`);
		console.error(
			"\nTo fix: Configure branch protection in repository settings",
		);
	} else if (
		error.message.includes("401") ||
		error.message.includes("Unauthorized")
	) {
		console.error("❌ GitHub CLI authentication required");
		console.error("Run: gh auth login");
	} else {
		console.error(`❌ Branch protection verification failed: ${error.message}`);
	}
	console.error(
		"\nSee BRANCH_PROTECTION_SETUP.md for configuration instructions",
	);
	process.exit(1);
}
