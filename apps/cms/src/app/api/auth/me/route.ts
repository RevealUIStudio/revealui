/**
 * Current User API Route
 *
 * GET /api/auth/me
 *
 * Returns the current authenticated user.
 */

import { getSession } from "@revealui/auth/server";
import { logger } from "@revealui/core/utils/logger";
import { type NextRequest, NextResponse } from "next/server";
import {
	createApplicationErrorResponse,
	createErrorResponse,
} from "@/lib/utils/error-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
	try {
		const session = await getSession(request.headers);

		if (!session) {
			return createApplicationErrorResponse(
				"Unauthorized",
				"UNAUTHORIZED",
				401,
			);
		}

		return NextResponse.json({
			user: {
				id: session.user.id,
				email: session.user.email,
				name: session.user.name,
				avatarUrl: session.user.avatarUrl,
				role: session.user.role,
				status: session.user.status,
			},
		});
	} catch (error) {
		logger.error("Error getting current user", { error });
		return createErrorResponse(error, {
			endpoint: "/api/auth/me",
			operation: "get_current_user",
		});
	}
}
