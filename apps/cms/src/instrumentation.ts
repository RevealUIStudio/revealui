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
		try {
			// Note: reveal package needs to be built for this import to work
			// Using dynamic import path that matches the built package structure
			const revealLogger = await import("reveal/core/observability/logger.js");
			const logger = revealLogger.logger;
			logger.info("Application started", {
				environment: process.env.NODE_ENV,
				version: process.env.npm_package_version,
			});
		} catch {
			// reveal package not available, skip structured logging
		}
	}
}
