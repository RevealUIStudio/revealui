import { type NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitConfigs } from "@/lib/middleware/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Example API route with rate limiting
 *
 * To apply rate limiting to RevealUI CMS auth endpoints,
 * you would need to create custom endpoints that wrap
 * the RevealUI CMS auth handlers with rate limiting middleware.
 */

const limiter = rateLimit(rateLimitConfigs.auth);

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await limiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// Your actual endpoint logic here
	return NextResponse.json({ message: "Request processed successfully" });
}

/**
 * Note: For RevealUI CMS authentication endpoints (/api/users/login),
 * rate limiting should be applied at the middleware level.
 *
 * Example middleware.ts implementation:
 *
 * import { rateLimit, rateLimitConfigs } from "@/lib/middleware/rate-limit"
 *
 * const authLimiter = rateLimit(rateLimitConfigs.auth)
 *
 * export async function middleware(request: NextRequest) {
 *   // Apply rate limiting to auth endpoints
 *   if (request.nextUrl.pathname.includes("/api/users/login") ||
 *       request.nextUrl.pathname.includes("/api/users/forgot-password")) {
 *     const rateLimitResponse = await authLimiter(request)
 *     if (rateLimitResponse) return rateLimitResponse
 *   }
 *
 *   // ... rest of middleware logic
 * }
 */
