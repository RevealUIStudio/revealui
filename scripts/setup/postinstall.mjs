import { execSync } from "node:child_process";

const truthyValues = new Set(["1", "true", "yes"]);

const normalizeFlag = (value) => (value || "").toLowerCase();
const isTruthy = (value) => truthyValues.has(normalizeFlag(value));

if (
	isTruthy(process.env.REVEALUI_SKIP_SUPABASE_TYPEGEN) ||
	isTruthy(process.env.SKIP_SUPABASE_TYPEGEN)
) {
	console.log("[postinstall] Supabase type generation skipped.");
	process.exit(0);
}

if (!isTruthy(process.env.REVEALUI_GENERATE_SUPABASE_TYPES)) {
	console.log(
		"[postinstall] Supabase type generation disabled. " +
			"Set REVEALUI_GENERATE_SUPABASE_TYPES=1 to enable.",
	);
	process.exit(0);
}

try {
	execSync("pnpm run generate:supabase-types", { stdio: "inherit" });
} catch {
	console.error("[postinstall] Supabase type generation failed.");
	process.exit(1);
}
