/**
 * External API mocks
 *
 * Provides mocks for HTTP clients, API responses, errors, and rate limiting
 */

export interface MockApiResponse {
	status: number;
	data: unknown;
	headers: Record<string, string>;
}

export interface MockApiRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: unknown;
}

const mockRequests: MockApiRequest[] = [];
const mockResponses: Map<string, MockApiResponse> = new Map();
const rateLimitCounts: Map<string, number> = new Map();

/**
 * Mock HTTP client
 */
export async function mockHttpRequest(options: {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
}): Promise<MockApiResponse> {
	const request: MockApiRequest = {
		url: options.url,
		method: options.method || "GET",
		headers: options.headers || {},
		body: options.body,
	};

	mockRequests.push(request);

	// Check for rate limiting
	const rateLimitKey = `${request.method}:${request.url}`;
	const currentCount = rateLimitCounts.get(rateLimitKey) || 0;
	rateLimitCounts.set(rateLimitKey, currentCount + 1);

	if (currentCount >= 10) {
		return {
			status: 429,
			data: { error: "Rate limit exceeded" },
			headers: { "Retry-After": "60" },
		};
	}

	// Check for mocked response
	const mockResponse = mockResponses.get(`${request.method}:${request.url}`);
	if (mockResponse) {
		return mockResponse;
	}

	// Default success response
	return {
		status: 200,
		data: { success: true },
		headers: { "Content-Type": "application/json" },
	};
}

/**
 * Mock API response
 */
export function setMockResponse(
	url: string,
	method: string,
	response: MockApiResponse,
): void {
	mockResponses.set(`${method}:${url}`, response);
}

/**
 * Mock API error
 */
export function setMockError(
	url: string,
	method: string,
	status: number,
	error: unknown,
): void {
	setMockResponse(url, method, {
		status,
		data: error,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Get mock requests
 */
export function getMockRequests(): MockApiRequest[] {
	return [...mockRequests];
}

/**
 * Clear mock requests
 */
export function clearMockRequests(): void {
	mockRequests.length = 0;
	mockResponses.clear();
	rateLimitCounts.clear();
}

/**
 * Create mock HTTP client
 */
export function createMockHttpClient() {
	return {
		request: mockHttpRequest,
		get: (url: string, options?: { headers?: Record<string, string> }) =>
			mockHttpRequest({ url, method: "GET", ...options }),
		post: (
			url: string,
			body?: unknown,
			options?: { headers?: Record<string, string> },
		) => mockHttpRequest({ url, method: "POST", body, ...options }),
		put: (
			url: string,
			body?: unknown,
			options?: { headers?: Record<string, string> },
		) => mockHttpRequest({ url, method: "PUT", body, ...options }),
		delete: (url: string, options?: { headers?: Record<string, string> }) =>
			mockHttpRequest({ url, method: "DELETE", ...options }),
		setResponse: setMockResponse,
		setError: setMockError,
		getRequests: getMockRequests,
		clear: clearMockRequests,
	};
}
