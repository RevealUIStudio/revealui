/**
 * Unit tests for markdown utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearMarkdownCache,
	clearMarkdownCacheEntry,
	getMarkdownCacheStats,
	loadMarkdownFile,
} from "../../app/utils/markdown";

// Mock fetch globally
global.fetch = vi.fn();

describe("loadMarkdownFile", () => {
	beforeEach(() => {
		clearMarkdownCache();
		vi.clearAllMocks();
	});

	it("should load and cache markdown file", async () => {
		const mockContent = "# Test Content";
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue(mockContent),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		const content = await loadMarkdownFile("/docs/test.md");

		expect(fetch).toHaveBeenCalledWith("/docs/test.md");
		expect(content).toBe(mockContent);
	});

	it("should use cache on second call", async () => {
		const mockContent = "# Test Content";
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue(mockContent),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		// First call
		await loadMarkdownFile("/docs/test.md");
		expect(fetch).toHaveBeenCalledTimes(1);

		// Second call should use cache
		const content = await loadMarkdownFile("/docs/test.md");
		expect(fetch).toHaveBeenCalledTimes(1); // Still 1, cache used
		expect(content).toBe(mockContent);
	});

	it("should normalize paths", async () => {
		const mockContent = "# Test";
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue(mockContent),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		// Path without leading slash should be normalized
		await loadMarkdownFile("docs/test.md");

		expect(fetch).toHaveBeenCalledWith("/docs/test.md");
	});

	it("should throw error on failed fetch", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		await expect(loadMarkdownFile("/docs/test.md")).rejects.toThrow();
	});

	it("should throw error on non-ok response", async () => {
		const mockResponse = {
			ok: false,
			status: 404,
			text: vi.fn().mockResolvedValue("Not Found"),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		await expect(loadMarkdownFile("/docs/test.md")).rejects.toThrow("404");
	});

	it("should bypass cache when useCache is false", async () => {
		const mockContent = "# Test Content";
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue(mockContent),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		// First call
		await loadMarkdownFile("/docs/test.md", true);
		expect(fetch).toHaveBeenCalledTimes(1);

		// Second call without cache
		await loadMarkdownFile("/docs/test.md", false);
		expect(fetch).toHaveBeenCalledTimes(2); // Called again
	});
});

describe("cache management", () => {
	beforeEach(() => {
		clearMarkdownCache();
		vi.clearAllMocks();
	});

	it("should clear all cache", async () => {
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue("# Content"),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		await loadMarkdownFile("/docs/test.md");
		expect(getMarkdownCacheStats().size).toBe(1);

		clearMarkdownCache();
		expect(getMarkdownCacheStats().size).toBe(0);
	});

	it("should clear specific cache entry", async () => {
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue("# Content"),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		await loadMarkdownFile("/docs/test1.md");
		await loadMarkdownFile("/docs/test2.md");
		expect(getMarkdownCacheStats().size).toBe(2);

		clearMarkdownCacheEntry("/docs/test1.md");
		const stats = getMarkdownCacheStats();
		expect(stats.size).toBe(1);
		expect(stats.entries[0].path).toBe("/docs/test2.md");
	});

	it("should provide cache statistics", async () => {
		const mockResponse = {
			ok: true,
			text: vi.fn().mockResolvedValue("# Content"),
		};

		vi.mocked(fetch).mockResolvedValue(mockResponse as any);

		await loadMarkdownFile("/docs/test.md");

		const stats = getMarkdownCacheStats();
		expect(stats.size).toBe(1);
		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].path).toBe("/docs/test.md");
		expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
	});
});
