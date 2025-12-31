/**
 * Next.js 16 Route Handler Template
 *
 * Usage: Create API routes in apps/cms/src/app/api/
 */

import { type NextRequest, NextResponse } from "next/server";

// Required for PayloadCMS routes
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		// Handler logic here
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		// Handler logic here
		return NextResponse.json({ success: true });
	} catch (error) {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
