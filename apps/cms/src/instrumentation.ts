/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts
 * Used for setting up monitoring and performance tracking
 */

export async function register() {
	// Initialize Vercel Speed Insights if available
	if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
		try {
			const { SpeedInsights } = await import("@vercel/speed-insights/next");
			// Speed Insights is automatically initialized via the component
		} catch {
			// Speed Insights not installed
		}
	}

	// Initialize structured logging
	if (process.env.NODE_ENV === "production") {
		// TODO: Implement RevealUI structured logging
		console.info("Application started", {
			environment: process.env.NODE_ENV,
			version: process.env.npm_package_version,
		});
	}
}
