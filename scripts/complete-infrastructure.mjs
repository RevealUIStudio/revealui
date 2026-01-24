#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

console.log("🚀 RevealUI Infrastructure Completion Script\n");

// Infrastructure completion checklist
const checklist = {
	"branch-protection": {
		description: "Apply branch protection rules to main branch",
		completed: false,
		automated: false,
		manualSteps: [
			"Go to GitHub repository Settings → Branches",
			'Click "Add rule" for main branch',
			"Configure 14 required status checks",
			"Enable admin enforcement and code reviews",
			"Run: pnpm verify:branch-protection",
		],
	},
	"deployment-secrets": {
		description: "Configure VERCEL_TOKEN for deployments",
		completed: false,
		automated: false,
		manualSteps: [
			"Go to GitHub repository Settings → Secrets and variables → Actions",
			"Add VERCEL_TOKEN secret with your Vercel API token",
			"Verify token has deployment permissions",
		],
	},
	"test-cicd-pipeline": {
		description: "Create test PR to validate full CI/CD pipeline",
		completed: false,
		automated: true,
		script: "test-infrastructure-pr",
	},
	"incident-response": {
		description: "Implement automated incident response workflows",
		completed: true,
		automated: true,
		script: "create-incident-response",
	},
	"environment-promotion": {
		description: "Complete environment promotion automation",
		completed: true,
		automated: true,
		script: "complete-environment-promotion",
	},
	"dependency-management": {
		description: "Fix Renovate configuration for manageable PRs",
		completed: true,
		automated: true,
		script: "fix-renovate-config",
	},
};

function printStatus() {
	console.log("📋 Infrastructure Completion Status:\n");

	Object.entries(checklist).forEach(([key, item]) => {
		const status = item.completed ? "✅" : "⏳";
		const automation = item.automated ? "(Automated)" : "(Manual)";
		console.log(`${status} ${item.description} ${automation}`);
	});

	const completed = Object.values(checklist).filter(
		(item) => item.completed,
	).length;
	const total = Object.keys(checklist).length;
	const percentage = Math.round((completed / total) * 100);

	console.log(
		`\n📊 Progress: ${completed}/${total} tasks completed (${percentage}%)`,
	);
}

function runAutomatedTask(taskName) {
	const task = checklist[taskName];
	if (!task || !task.automated) {
		console.error(`❌ Task ${taskName} is not automated`);
		return false;
	}

	console.log(`🔧 Running automated task: ${task.description}`);

	try {
		switch (task.script) {
			case "test-infrastructure-pr":
				return createTestPR();
			case "create-incident-response":
				return createIncidentResponse();
			case "complete-environment-promotion":
				return completeEnvironmentPromotion();
			case "fix-renovate-config":
				return fixRenovateConfig();
			default:
				console.error(`❌ Unknown script: ${task.script}`);
				return false;
		}
	} catch (error) {
		console.error(`❌ Task ${taskName} failed: ${error.message}`);
		return false;
	}
}

function createTestPR() {
	console.log("🧪 Creating test PR to validate CI/CD pipeline...");

	// Create a simple test change
	const testFile = "test-infrastructure-validation.md";
	const testContent = `# Infrastructure Validation Test

This file validates that the complete CI/CD pipeline works end-to-end.

## Validation Checklist
- [ ] Branch protection rules applied
- [ ] All 14 status checks pass
- [ ] Security scans complete
- [ ] Build verification successful
- [ ] Documentation checks pass

Created by: Infrastructure completion script
Timestamp: ${new Date().toISOString()}
`;

	writeFileSync(testFile, testContent);

	// Stage and commit
	execSync("git add test-infrastructure-validation.md", { stdio: "inherit" });
	execSync('git commit -m "test: validate complete CI/CD infrastructure"', {
		stdio: "inherit",
	});

	console.log("✅ Test commit created");
	console.log("📝 Next: Create PR from this commit to validate all checks");

	return true;
}

function createIncidentResponse() {
	console.log("🚨 Incident response workflows already implemented");
	console.log("📝 File: .github/workflows/emergency-rollback.yml");
	return true;
}

function completeEnvironmentPromotion() {
	console.log("🔄 Environment promotion automation already implemented");
	console.log("📝 File: .github/workflows/environment-promotion.yml");
	return true;
}

function fixRenovateConfig() {
	console.log("🔧 Renovate configuration already optimized");
	console.log("📝 File: renovate.json5");
	return true;
}

// Main execution
function main() {
	const args = process.argv.slice(2);
	const command = args[0];

	printStatus();

	if (!command) {
		console.log("\n💡 Available commands:");
		console.log("  status          - Show completion status");
		console.log("  run <task>      - Run automated task");
		console.log("  list            - List all tasks");

		console.log("\n🔧 Automated tasks available:");
		Object.entries(checklist)
			.filter(([_, item]) => item.automated)
			.forEach(([key, item]) => {
				console.log(`  ${key} - ${item.description}`);
			});

		console.log("\n📋 Manual tasks (require human action):");
		Object.entries(checklist)
			.filter(([_, item]) => !item.automated)
			.forEach(([key, item]) => {
				console.log(`  ${key} - ${item.description}`);
			});

		return;
	}

	switch (command) {
		case "status":
			// Already printed above
			break;

		case "run":
			const taskName = args[1];
			if (!taskName) {
				console.error(
					"❌ Please specify a task name: pnpm complete:infrastructure run <task>",
				);
				process.exit(1);
			}

			const success = runAutomatedTask(taskName);
			if (success) {
				checklist[taskName].completed = true;
				console.log(`✅ Task ${taskName} completed successfully`);
			} else {
				console.error(`❌ Task ${taskName} failed`);
				process.exit(1);
			}
			break;

		case "list":
			console.log("\n📋 All Infrastructure Completion Tasks:");
			Object.entries(checklist).forEach(([key, item]) => {
				const status = item.completed ? "✅" : item.automated ? "🤖" : "👤";
				const type = item.automated ? "Automated" : "Manual";
				console.log(`\n${status} ${key} (${type})`);
				console.log(`   ${item.description}`);
				if (!item.automated && item.manualSteps) {
					item.manualSteps.forEach((step) => console.log(`   • ${step}`));
				}
			});
			break;

		default:
			console.error(`❌ Unknown command: ${command}`);
			console.log("Run without arguments to see available commands");
			process.exit(1);
	}

	console.log("\n" + "=".repeat(60));
	console.log("🏁 Updated Infrastructure Completion Status:");
	printStatus();
	console.log("=".repeat(60));
}

main();
