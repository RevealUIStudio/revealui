import { rateLimit } from "@/lib/middleware/rate-limit";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Server-side OpenAI Chat API
 * Securely handles OpenAI API calls without exposing API keys to client
 */

const limiter = rateLimit({
	maxRequests: 10, // 10 requests per window (stricter for AI)
	windowMs: 60 * 1000, // 1 minute
});

export async function POST(request: NextRequest) {
	// Apply rate limiting
	const rateLimitResponse = await limiter(request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		// Parse request body
		const body = await request.json();
		const { message } = body;

		// Validate input
		if (!message || typeof message !== "string") {
			return NextResponse.json(
				{ error: "Invalid message format" },
				{ status: 400 },
			);
		}

		if (message.length > 4000) {
			return NextResponse.json(
				{ error: "Message too long (max 4000 characters)" },
				{ status: 400 },
			);
		}

		// Check if OpenAI API key is configured
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "OpenAI integration not configured" },
				{ status: 503 },
			);
		}

		// Call OpenAI API (server-side only)
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: "gpt-4",
				messages: [{ role: "user", content: message }],
				max_tokens: 500,
				temperature: 0.7,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();

		if (data.choices && data.choices[0].message.content) {
			return NextResponse.json({
				message: data.choices[0].message.content,
			});
		}

		return NextResponse.json(
			{ error: "No response from OpenAI" },
			{ status: 500 },
		);
	} catch (error) {
		// Log error (but don't expose details to client)
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		return NextResponse.json(
			{ error: "Failed to process chat request. Please try again later." },
			{ status: 500 },
		);
	}
}
