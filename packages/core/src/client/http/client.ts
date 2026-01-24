/**
 * Base API client for fetching data from RevealUI CMS
 * Uses environment variables to determine CMS URL
 */

// Client-side (browser) - Vite exposes VITE_* prefixed env vars
const getClientCMSURL = () => {
	if (typeof window === "undefined") return "http://localhost:4000";

	// Vite only exposes VITE_* prefixed variables to client
	return (
		import.meta.env.VITE_CMS_URL ||
		import.meta.env.VITE_REVEALUI_PUBLIC_SERVER_URL ||
		"http://localhost:4000"
	);
};

// Server-side (Node.js) - Can access all process.env variables
const getServerCMSURL = () => {
	return (
		process.env.NEXT_PUBLIC_CMS_URL ||
		process.env.REVEALUI_PUBLIC_SERVER_URL ||
		process.env.VITE_CMS_URL || // Fallback for SSR
		"http://localhost:4000"
	);
};

const CMS_URL =
	typeof window !== "undefined" ? getClientCMSURL() : getServerCMSURL();

export interface FetchOptions extends RequestInit {
	params?: Record<string, string | number | boolean>;
}

/**
 * Base function to fetch data from CMS API
 * @param endpoint - API endpoint path (e.g., '/api/collections/pages')
 * @param options - Fetch options including query parameters
 * @returns Promise with parsed JSON response
 */
export async function fetchFromCMS<T>(
	endpoint: string,
	options?: FetchOptions,
): Promise<T> {
	const { params, ...fetchOptions } = options || {};

	// Build URL with query parameters
	const url = new URL(endpoint, CMS_URL);
	if (params) {
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, String(value));
		});
	}

	const response = await fetch(url.toString(), {
		...fetchOptions,
		headers: {
			"Content-Type": "application/json",
			...fetchOptions.headers,
		},
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "Unknown error");
		throw new Error(
			`CMS API error: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return response.json();
}
